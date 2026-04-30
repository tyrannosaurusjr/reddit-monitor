#!/bin/bash
# Example seed script for Turso — replace USER_ID, DB name, and project data with your own.
USER_ID="your-user-id-here"
DB="your-turso-db-name"

echo "=== Creating Projects ==="

turso db shell $DB "INSERT INTO Project (id, name, slug, siteUrl, description, color, enabled, createdAt, updatedAt, userId) VALUES
  ('proj_example', 'My Project', 'myproject', 'mysite.com', 'My site description', '#16a34a', 1, datetime('now'), datetime('now'), '$USER_ID');"

echo "Projects created"

echo ""
echo "=== Adding Subreddits ==="

for sub in relevant-subreddit-1 relevant-subreddit-2; do
  turso db shell $DB "INSERT INTO SubredditTarget (id, name, enabled, createdAt, updatedAt, projectId) VALUES ('sub_ex_${sub}', '${sub}', 1, datetime('now'), datetime('now'), 'proj_example');"
done
echo "  Subreddits added"

echo ""
echo "=== Adding Keywords ==="

turso db shell $DB "INSERT INTO KeywordFilter (id, keyword, enabled, isGlobal, createdAt, projectId) VALUES
  ('kw_ex_1', 'your keyword', 1, 1, datetime('now'), 'proj_example'),
  ('kw_ex_2', 'another keyword', 1, 1, datetime('now'), 'proj_example');"

echo "  Keywords added"

echo ""
echo "=== Verifying ==="
turso db shell $DB "SELECT name, slug, siteUrl FROM Project;"

echo ""
echo "=== Done! Refresh the app ==="
