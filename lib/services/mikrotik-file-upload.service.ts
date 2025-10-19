// File: src/services/mikrotik-file-upload.service.ts

import * as ftp from 'basic-ftp';
import { Client as SSHClient } from 'ssh2';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Readable } from 'stream';

/**
 * ============================================================================
 * TYPE DEFINITIONS
 * ============================================================================
 */

interface RouterConnection {
  ipAddress: string;
  port?: number;
  apiUser?: string;
  apiPassword?: string;
  ftpPort?: number;
  sshPort?: number;
}

interface UploadOptions {
  protocol: 'ftp' | 'sftp';
  retries?: number;
  timeout?: number;
  verifyUpload?: boolean;
}

interface FileUpload {
  localPath?: string;
  content?: string;
  remotePath: string;
  filename: string;
}

interface UploadResult {
  success: boolean;
  filename: string;
  remotePath: string;
  error?: string;
  size?: number;
  uploadTime?: number;
}

interface BatchUploadResult {
  success: boolean;
  totalFiles: number;
  uploadedFiles: number;
  failedFiles: number;
  results: UploadResult[];
  totalTime: number;
}

/**
 * ============================================================================
 * CAPTIVE PORTAL FILES CONFIGURATION
 * ============================================================================
 */

export const CAPTIVE_PORTAL_FILES = {
  // HTML files
  login: {
    filename: 'login.html',
    remotePath: '/hotspot/login.html',
    required: true,
  },
  status: {
    filename: 'status.html',
    remotePath: '/hotspot/status.html',
    required: true,
  },
  logout: {
    filename: 'logout.html',
    remotePath: '/hotspot/logout.html',
    required: true,
  },
  error: {
    filename: 'error.html',
    remotePath: '/hotspot/error.html',
    required: true,
  },
  alogin: {
    filename: 'alogin.html',
    remotePath: '/hotspot/alogin.html',
    required: true,
  },
  // Configuration files
  errors: {
    filename: 'errors.txt',
    remotePath: '/hotspot/errors.txt',
    required: true,
  },
  apiConfig: {
    filename: 'api.json',
    remotePath: '/hotspot/api.json',
    required: true,
  },
  // Optional files
  redirect: {
    filename: 'redirect.html',
    remotePath: '/hotspot/redirect.html',
    required: false,
  },
  rlogin: {
    filename: 'rlogin.html',
    remotePath: '/hotspot/rlogin.html',
    required: false,
  },
} as const;

/**
 * ============================================================================
 * MAIN SERVICE CLASS
 * ============================================================================
 */

export class MikroTikFileUploadService {
  private readonly DEFAULT_FTP_PORT = 21;
  private readonly DEFAULT_SSH_PORT = 22;
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private readonly DEFAULT_RETRIES = 3;

  /**
   * Upload a single file to MikroTik router
   * 
   * @param connection - Router connection details
   * @param file - File to upload
   * @param options - Upload options
   * @returns Upload result
   */
  async uploadFile(
    connection: RouterConnection,
    file: FileUpload,
    options: UploadOptions = { protocol: 'ftp' }
  ): Promise<UploadResult> {
    const startTime = Date.now();
    const retries = options.retries ?? this.DEFAULT_RETRIES;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (options.protocol === 'ftp') {
          return await this.uploadViaFTP(connection, file, options);
        } else {
          return await this.uploadViaSFTP(connection, file, options);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        if (attempt < retries) {
          console.log(`Upload attempt ${attempt} failed, retrying... (${errorMessage})`);
          await this.delay(2000 * attempt); // Exponential backoff
          continue;
        }

        // Final attempt failed
        return {
          success: false,
          filename: file.filename,
          remotePath: file.remotePath,
          error: errorMessage,
          uploadTime: Date.now() - startTime,
        };
      }
    }

    // Should never reach here, but TypeScript requires return
    return {
      success: false,
      filename: file.filename,
      remotePath: file.remotePath,
      error: 'Max retries exceeded',
      uploadTime: Date.now() - startTime,
    };
  }

  /**
   * Upload multiple files in batch
   * 
   * @param connection - Router connection details
   * @param files - Array of files to upload
   * @param options - Upload options
   * @returns Batch upload result
   */
  async uploadBatch(
    connection: RouterConnection,
    files: FileUpload[],
    options: UploadOptions = { protocol: 'ftp' }
  ): Promise<BatchUploadResult> {
    const startTime = Date.now();
    const results: UploadResult[] = [];

    for (const file of files) {
      const result = await this.uploadFile(connection, file, options);
      results.push(result);
    }

    const uploadedFiles = results.filter((r) => r.success).length;
    const failedFiles = results.filter((r) => !r.success).length;

    return {
      success: failedFiles === 0,
      totalFiles: files.length,
      uploadedFiles,
      failedFiles,
      results,
      totalTime: Date.now() - startTime,
    };
  }

  /**
   * Upload all captive portal files from directory
   * 
   * @param connection - Router connection details
   * @param filesDirectory - Directory containing captive portal files
   * @param apiJsonContent - Generated api.json content
   * @param options - Upload options
   * @returns Batch upload result
   */
  async uploadCaptivePortal(
    connection: RouterConnection,
    filesDirectory: string,
    apiJsonContent: string,
    options: UploadOptions = { protocol: 'ftp' }
  ): Promise<BatchUploadResult> {
    const files: FileUpload[] = [];

    // Add HTML and text files from directory
    for (const [key, config] of Object.entries(CAPTIVE_PORTAL_FILES)) {
      if (key === 'apiConfig') continue; // Handle api.json separately

      const localPath = path.join(filesDirectory, config.filename);
      
      // Check if file exists
      try {
        await fs.access(localPath);
        files.push({
          localPath,
          remotePath: config.remotePath,
          filename: config.filename,
        });
      } catch (error) {
        if (config.required) {
          throw new Error(`Required file not found: ${config.filename}`);
        }
        console.log(`Optional file not found, skipping: ${config.filename}`);
      }
    }

    // Add api.json from generated content
    files.push({
      content: apiJsonContent,
      remotePath: CAPTIVE_PORTAL_FILES.apiConfig.remotePath,
      filename: CAPTIVE_PORTAL_FILES.apiConfig.filename,
    });

    return await this.uploadBatch(connection, files, options);
  }

  /**
   * ============================================================================
   * PRIVATE FTP METHODS
   * ============================================================================
   */

  private async uploadViaFTP(
    connection: RouterConnection,
    file: FileUpload,
    options: UploadOptions
  ): Promise<UploadResult> {
    const startTime = Date.now();
    const client = new ftp.Client();
    client.ftp.timeout = options.timeout ?? this.DEFAULT_TIMEOUT;

    try {
      // Connect to FTP server
      await client.access({
        host: connection.ipAddress,
        port: connection.ftpPort ?? this.DEFAULT_FTP_PORT,
        user: connection.apiUser ?? 'admin',
        password: connection.apiPassword ?? '',
        secure: false,
      });

      console.log(`FTP connected to ${connection.ipAddress}`);

      // Ensure hotspot directory exists
      try {
        await client.ensureDir('/hotspot');
      } catch (error) {
        // Directory might already exist, ignore error
        console.log('Hotspot directory check:', error);
      }

      let size = 0;

      // Upload from file or content
      if (file.localPath) {
        // Upload from file
        const stats = await fs.stat(file.localPath);
        size = stats.size;
        await client.uploadFrom(file.localPath, file.remotePath);
      } else if (file.content) {
        // Upload from string content
        size = Buffer.byteLength(file.content, 'utf8');
        const readable = Readable.from([file.content]);
        await client.uploadFrom(readable, file.remotePath);
      } else {
        throw new Error('Either localPath or content must be provided');
      }

      // Verify upload if requested
      if (options.verifyUpload) {
        const verified = await this.verifyFTPUpload(client, file.remotePath, size);
        if (!verified) {
          throw new Error('Upload verification failed');
        }
      }

      console.log(`Successfully uploaded: ${file.filename} -> ${file.remotePath}`);

      return {
        success: true,
        filename: file.filename,
        remotePath: file.remotePath,
        size,
        uploadTime: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`FTP upload failed for ${file.filename}:`, errorMessage);
      throw error;
    } finally {
      client.close();
    }
  }

  private async verifyFTPUpload(
    client: ftp.Client,
    remotePath: string,
    expectedSize: number
  ): Promise<boolean> {
    try {
      const list = await client.list(path.dirname(remotePath));
      const file = list.find((f) => f.name === path.basename(remotePath));
      
      if (!file) {
        console.error('File not found after upload');
        return false;
      }

      if (file.size !== expectedSize) {
        console.error(`Size mismatch: expected ${expectedSize}, got ${file.size}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Verification failed:', error);
      return false;
    }
  }

  /**
   * ============================================================================
   * PRIVATE SFTP METHODS
   * ============================================================================
   */

  private async uploadViaSFTP(
    connection: RouterConnection,
    file: FileUpload,
    options: UploadOptions
  ): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const sshClient = new SSHClient();
      const timeout = options.timeout ?? this.DEFAULT_TIMEOUT;

      // Set connection timeout
      const timeoutHandle = setTimeout(() => {
        sshClient.end();
        reject(new Error('SFTP connection timeout'));
      }, timeout);

      sshClient.on('ready', () => {
        clearTimeout(timeoutHandle);
        console.log(`SSH connected to ${connection.ipAddress}`);

        sshClient.sftp((err, sftp) => {
          if (err) {
            sshClient.end();
            return reject(err);
          }

          // Ensure directory exists
          const dir = path.dirname(file.remotePath);
          sftp.mkdir(dir, (mkdirErr) => {
            // Ignore error if directory already exists

            const upload = async () => {
              try {
                let size = 0;

                if (file.localPath) {
                  // Upload from file
                  const stats = await fs.stat(file.localPath);
                  size = stats.size;
                  
                  await new Promise<void>((res, rej) => {
                    sftp.fastPut(file.localPath!, file.remotePath, (putErr) => {
                      if (putErr) return rej(putErr);
                      res();
                    });
                  });
                } else if (file.content) {
                  // Upload from content
                  size = Buffer.byteLength(file.content, 'utf8');
                  const buffer = Buffer.from(file.content, 'utf8');
                  
                  await new Promise<void>((res, rej) => {
                    const writeStream = sftp.createWriteStream(file.remotePath);
                    writeStream.on('close', () => res());
                    writeStream.on('error', (writeErr) => rej(writeErr));
                    writeStream.write(buffer);
                    writeStream.end();
                  });
                } else {
                  throw new Error('Either localPath or content must be provided');
                }

                // Verify upload if requested
                if (options.verifyUpload) {
                  const verified = await this.verifySFTPUpload(sftp, file.remotePath, size);
                  if (!verified) {
                    throw new Error('Upload verification failed');
                  }
                }

                console.log(`Successfully uploaded: ${file.filename} -> ${file.remotePath}`);

                sshClient.end();

                resolve({
                  success: true,
                  filename: file.filename,
                  remotePath: file.remotePath,
                  size,
                  uploadTime: Date.now() - startTime,
                });
              } catch (error) {
                sshClient.end();
                reject(error);
              }
            };

            upload().catch(reject);
          });
        });
      });

      sshClient.on('error', (err) => {
        clearTimeout(timeoutHandle);
        console.error(`SSH connection error:`, err);
        reject(err);
      });

      // Connect
      sshClient.connect({
        host: connection.ipAddress,
        port: connection.sshPort ?? this.DEFAULT_SSH_PORT,
        username: connection.apiUser ?? 'admin',
        password: connection.apiPassword ?? '',
        readyTimeout: timeout,
      });
    });
  }

  private async verifySFTPUpload(
    sftp: any,
    remotePath: string,
    expectedSize: number
  ): Promise<boolean> {
    return new Promise((resolve) => {
      sftp.stat(remotePath, (err: any, stats: any) => {
        if (err) {
          console.error('Verification failed:', err);
          return resolve(false);
        }

        if (stats.size !== expectedSize) {
          console.error(`Size mismatch: expected ${expectedSize}, got ${stats.size}`);
          return resolve(false);
        }

        resolve(true);
      });
    });
  }

  /**
   * ============================================================================
   * UTILITY METHODS
   * ============================================================================
   */

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Test connection to MikroTik router
   */
  async testConnection(
    connection: RouterConnection,
    protocol: 'ftp' | 'sftp' = 'ftp'
  ): Promise<{ success: boolean; message: string; latency?: number }> {
    const startTime = Date.now();

    try {
      if (protocol === 'ftp') {
        const client = new ftp.Client();
        client.ftp.timeout = 10000;

        await client.access({
          host: connection.ipAddress,
          port: connection.ftpPort ?? this.DEFAULT_FTP_PORT,
          user: connection.apiUser ?? 'admin',
          password: connection.apiPassword ?? '',
          secure: false,
        });

        client.close();
      } else {
        await new Promise<void>((resolve, reject) => {
          const sshClient = new SSHClient();
          
          const timeout = setTimeout(() => {
            sshClient.end();
            reject(new Error('Connection timeout'));
          }, 10000);

          sshClient.on('ready', () => {
            clearTimeout(timeout);
            sshClient.end();
            resolve();
          });

          sshClient.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });

          sshClient.connect({
            host: connection.ipAddress,
            port: connection.sshPort ?? this.DEFAULT_SSH_PORT,
            username: connection.apiUser ?? 'admin',
            password: connection.apiPassword ?? '',
            readyTimeout: 10000,
          });
        });
      }

      const latency = Date.now() - startTime;

      return {
        success: true,
        message: `Connected successfully via ${protocol.toUpperCase()}`,
        latency,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: `Connection failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Delete a file from MikroTik router
   */
  async deleteFile(
    connection: RouterConnection,
    remotePath: string,
    protocol: 'ftp' | 'sftp' = 'ftp'
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (protocol === 'ftp') {
        const client = new ftp.Client();
        await client.access({
          host: connection.ipAddress,
          port: connection.ftpPort ?? this.DEFAULT_FTP_PORT,
          user: connection.apiUser ?? 'admin',
          password: connection.apiPassword ?? '',
          secure: false,
        });

        await client.remove(remotePath);
        client.close();
      } else {
        // SFTP delete implementation
        await new Promise<void>((resolve, reject) => {
          const sshClient = new SSHClient();

          sshClient.on('ready', () => {
            sshClient.sftp((err, sftp) => {
              if (err) {
                sshClient.end();
                return reject(err);
              }

              sftp.unlink(remotePath, (unlinkErr) => {
                sshClient.end();
                if (unlinkErr) return reject(unlinkErr);
                resolve();
              });
            });
          });

          sshClient.on('error', reject);

          sshClient.connect({
            host: connection.ipAddress,
            port: connection.sshPort ?? this.DEFAULT_SSH_PORT,
            username: connection.apiUser ?? 'admin',
            password: connection.apiPassword ?? '',
          });
        });
      }

      return {
        success: true,
        message: `File deleted: ${remotePath}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: `Delete failed: ${errorMessage}`,
      };
    }
  }

  /**
   * List files in directory on MikroTik router
   */
  async listFiles(
    connection: RouterConnection,
    remotePath: string = '/hotspot',
    protocol: 'ftp' | 'sftp' = 'ftp'
  ): Promise<{ success: boolean; files?: string[]; error?: string }> {
    try {
      let files: string[] = [];

      if (protocol === 'ftp') {
        const client = new ftp.Client();
        await client.access({
          host: connection.ipAddress,
          port: connection.ftpPort ?? this.DEFAULT_FTP_PORT,
          user: connection.apiUser ?? 'admin',
          password: connection.apiPassword ?? '',
          secure: false,
        });

        const list = await client.list(remotePath);
        files = list.map((f) => f.name);
        client.close();
      } else {
        // SFTP list implementation
        files = await new Promise<string[]>((resolve, reject) => {
          const sshClient = new SSHClient();

          sshClient.on('ready', () => {
            sshClient.sftp((err, sftp) => {
              if (err) {
                sshClient.end();
                return reject(err);
              }

              sftp.readdir(remotePath, (readdirErr, list) => {
                sshClient.end();
                if (readdirErr) return reject(readdirErr);
                resolve(list.map((f) => f.filename));
              });
            });
          });

          sshClient.on('error', reject);

          sshClient.connect({
            host: connection.ipAddress,
            port: connection.sshPort ?? this.DEFAULT_SSH_PORT,
            username: connection.apiUser ?? 'admin',
            password: connection.apiPassword ?? '',
          });
        });
      }

      return {
        success: true,
        files,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}

/**
 * ============================================================================
 * SINGLETON INSTANCE EXPORT
 * ============================================================================
 */

export const mikrotikFileUploadService = new MikroTikFileUploadService();

/**
 * ============================================================================
 * USAGE EXAMPLES
 * ============================================================================
 */

/*

// Example 1: Upload complete captive portal during router onboarding
import { mikrotikFileUploadService } from '@/services/mikrotik-file-upload.service';
import { captivePortalConfigService } from '@/services/captive-portal-config.service';

async function setupCaptivePortal(routerId: string, customerId: string) {
  // Get router and customer data
  const router = await routersCollection.findOne({ _id: new ObjectId(routerId) });
  const customer = await customersCollection.findOne({ _id: new ObjectId(customerId) });

  // Generate api.json
  const apiJsonContent = captivePortalConfigService.generateApiJson(
    router,
    customer,
    'production'
  );

  // Upload all files
  const result = await mikrotikFileUploadService.uploadCaptivePortal(
    router.connection,
    './captive-portal-files', // Directory with HTML files
    apiJsonContent,
    { protocol: 'ftp', retries: 3, verifyUpload: true }
  );

  console.log(`Upload complete: ${result.uploadedFiles}/${result.totalFiles} files`);
  
  if (!result.success) {
    console.error('Failed uploads:', result.results.filter(r => !r.success));
  }

  return result;
}

// Example 2: Update only api.json (branding changed)
async function updateBranding(routerId: string) {
  const router = await routersCollection.findOne({ _id: new ObjectId(routerId) });
  const customer = await customersCollection.findOne({ _id: router.customerId });

  const apiJsonContent = captivePortalConfigService.generateApiJson(
    router,
    customer,
    'production'
  );

  const result = await mikrotikFileUploadService.uploadFile(
    router.connection,
    {
      content: apiJsonContent,
      remotePath: '/hotspot/api.json',
      filename: 'api.json'
    },
    { protocol: 'ftp', verifyUpload: true }
  );

  return result;
}

// Example 3: Test connection before upload
async function testRouterConnection(routerId: string) {
  const router = await routersCollection.findOne({ _id: new ObjectId(routerId) });

  const ftpTest = await mikrotikFileUploadService.testConnection(
    router.connection,
    'ftp'
  );

  console.log('FTP Test:', ftpTest);

  const sftpTest = await mikrotikFileUploadService.testConnection(
    router.connection,
    'sftp'
  );

  console.log('SFTP Test:', sftpTest);

  return { ftp: ftpTest, sftp: sftpTest };
}

// Example 4: List files on router
async function listCaptivePortalFiles(routerId: string) {
  const router = await routersCollection.findOne({ _id: new ObjectId(routerId) });

  const result = await mikrotikFileUploadService.listFiles(
    router.connection,
    '/hotspot',
    'ftp'
  );

  if (result.success) {
    console.log('Files on router:', result.files);
  }

  return result;
}

// Example 5: Delete old files before uploading new ones
async function refreshCaptivePortal(routerId: string, customerId: string) {
  const router = await routersCollection.findOne({ _id: new ObjectId(routerId) });

  // Delete old files
  const filesToDelete = [
    '/hotspot/login.html',
    '/hotspot/status.html',
    '/hotspot/logout.html',
    '/hotspot/error.html',
    '/hotspot/alogin.html',
    '/hotspot/errors.txt',
    '/hotspot/api.json'
  ];

  for (const file of filesToDelete) {
    await mikrotikFileUploadService.deleteFile(router.connection, file, 'ftp');
  }

  // Upload fresh files
  return await setupCaptivePortal(routerId, customerId);
}

*/