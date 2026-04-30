#!/bin/bash
# Example seed script — replace project names, slugs, siteUrls, and keywords with your own.
BASE="http://localhost:3000"

echo "=== Creating Projects ==="

PROJECT1=$(curl -s -X POST "$BASE/api/projects" -H "Content-Type: application/json" \
  -d '{"name":"My Project","slug":"myproject","siteUrl":"mysite.com","description":"My site description","color":"#16a34a"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo "My Project: $PROJECT1"

echo ""
echo "=== Adding Subreddits ==="

for sub in relevant-subreddit-1 relevant-subreddit-2; do
  curl -s -X POST "$BASE/api/subreddits" -H "Content-Type: application/json" \
    -d "{\"name\":\"$sub\",\"projectId\":\"$PROJECT1\"}" > /dev/null
  echo "  My Project + r/$sub"
done

echo ""
echo "=== Adding Keywords ==="

for kw in "your keyword" "another keyword"; do
  curl -s -X POST "$BASE/api/keywords" -H "Content-Type: application/json" \
    -d "{\"keyword\":\"$kw\",\"projectId\":\"$PROJECT1\",\"isGlobal\":true}" > /dev/null
done
echo "  My Project: keywords added"

echo ""
echo "=== Done! ==="
echo "Open $BASE to see your projects"
