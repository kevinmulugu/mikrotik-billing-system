// src/app/messages/page.tsx
import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { SendMessageForm } from '@/components/messages/send-message-form';
import { MessageHistory } from '@/components/messages/message-history';
import { MessageTemplates } from '@/components/messages/message-templates';

export const metadata: Metadata = {
  title: 'Messages - MikroTik Billing',
  description: 'Send campaign and advisory messages to your customers',
};

async function getMessagingData(userId: string) {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'mikrotik_billing');

    // Get all routers owned by this user
    const routers = await db
      .collection('routers')
      .find({ userId: new ObjectId(userId) })
      .project({ _id: 1, routerInfo: 1 })
      .toArray();

    const routerIds = routers.map((r) => r._id);

    // Get total customer count
    const totalCustomers = await db
      .collection('customers')
      .countDocuments({ routerId: { $in: routerIds } });

    // Get customers by router
    const customersByRouter = await Promise.all(
      routers.map(async (router) => {
        const count = await db
          .collection('customers')
          .countDocuments({ routerId: router._id });

        return {
          id: router._id.toString(),
          name: router.routerInfo?.name || 'Unnamed Router',
          customerCount: count,
        };
      })
    );

    // Get message templates
    const templates = await db
      .collection('message_templates')
      .find({
        $or: [
          { userId: new ObjectId(userId) },
          { isSystem: true, isActive: true }
        ]
      })
      .sort({ isSystem: -1, category: 1, name: 1 })
      .toArray();

    // Get recent messages
    const recentMessages = await db
      .collection('messages')
      .find({ userId: new ObjectId(userId) })
      .sort({ sentAt: -1 })
      .limit(20)
      .toArray();

    return {
      routers: customersByRouter,
      totalCustomers,
      templates: templates.map((t) => ({
        id: t._id.toString(),
        name: t.name,
        category: t.category,
        message: t.message,
        variables: t.variables || [],
        isSystem: t.isSystem,
        usageCount: t.usageCount || 0,
      })),
      recentMessages: recentMessages.map((m) => ({
        id: m._id.toString(),
        recipientType: m.recipientType,
        routerId: m.routerId?.toString(),
        routerName: m.recipientType === 'router' 
          ? routers.find((r) => r._id.equals(m.routerId))?.routerInfo?.name || 'Unknown Router'
          : null,
        message: m.message,
        recipientCount: m.recipientCount,
        status: m.status,
        sentAt: m.sentAt,
      })),
    };
  } catch (error) {
    console.error('Error fetching messaging data:', error);
    return null;
  }
}

export default async function MessagesPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  const data = await getMessagingData(session.user.id);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Failed to load messaging</h2>
          <p className="text-muted-foreground">Please try again later</p>
        </div>
      </div>
    );
  }

  return (
    <Tabs defaultValue="send" className="space-y-6">
      <TabsList>
        <TabsTrigger value="send">Send Message</TabsTrigger>
        <TabsTrigger value="history">Message History</TabsTrigger>
        <TabsTrigger value="templates">Templates</TabsTrigger>
      </TabsList>

      <TabsContent value="send" className="space-y-6">
        <SendMessageForm 
          routers={data.routers} 
          totalCustomers={data.totalCustomers}
          templates={data.templates}
        />
      </TabsContent>

      <TabsContent value="history" className="space-y-6">
        <MessageHistory messages={data.recentMessages} />
      </TabsContent>

      <TabsContent value="templates" className="space-y-6">
        <MessageTemplates templates={data.templates} />
      </TabsContent>
    </Tabs>
  );
}
