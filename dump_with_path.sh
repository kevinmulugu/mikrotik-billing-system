#!/usr/bin/env bash
# Run this script from within the source directory.
# It dumps all files (excluding node_modules, .git, .next, .claude)
# into ~/dump, each file's first line showing its relative path.
# The dump filenames use the relative path with '/' replaced by '_'.

set -euo pipefail

origin_dir="$(pwd)"
dump_dir="$HOME/dump"

mkdir -p "$dump_dir"

echo "Dumping files from: $origin_dir"
echo "Output directory: $dump_dir"
echo

find "$origin_dir" \
  -type d \( -name "node_modules" -o -name ".git" -o -name ".next" -o -name ".claude" \) -prune -o \
  -type f -print | while read -r file; do

  # Get relative path
  rel_path="${file#$origin_dir/}"

  # Replace slashes with underscores for filename
  safe_name="${rel_path//\//_}"
  target_file="$dump_dir/$safe_name"

  # Write relative path as comment + file contents
  {
    echo "# $rel_path"
    cat "$file"
  } > "$target_file"

  echo "Dumped: $target_file"
done

echo
echo "✅ Dump complete. Files written to: $dump_dir"
