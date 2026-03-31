#!/bin/bash
# Seed projects into Turso for user cmnd20q6l000004ici2xjatzw
USER_ID="cmnd20q6l000004ici2xjatzw"
DB="redditreach"

echo "=== Creating Projects ==="

turso db shell $DB "INSERT INTO Project (id, name, slug, siteUrl, description, color, enabled, createdAt, updatedAt, userId) VALUES
  ('proj_jacamp', 'JaCamp', 'jacamp', 'jacamp.com', 'Camping in Japan', '#16a34a', 1, datetime('now'), datetime('now'), '$USER_ID'),
  ('proj_music', 'Music In Japan', 'musicinjapan', 'musicinjapan.com', 'Japanese music scene', '#7c3aed', 1, datetime('now'), datetime('now'), '$USER_ID'),
  ('proj_wildmeat', 'Wild Meat Japan', 'wildmeatjapan', 'wildmeatjapan.com', 'Wild game and hunting in Japan', '#dc2626', 1, datetime('now'), datetime('now'), '$USER_ID');"

echo "Projects created"

echo "=== Adding Subreddits ==="

# JaCamp
for sub in japantravel japantraveltips japanlife japanoutdoors camping backpacking hiking wildcamping overlanding solotravel; do
  turso db shell $DB "INSERT INTO SubredditTarget (id, name, enabled, createdAt, updatedAt, projectId) VALUES ('sub_jc_${sub}', '${sub}', 1, datetime('now'), datetime('now'), 'proj_jacamp');"
done
echo "  JaCamp subs added"

# Music In Japan
for sub in japantravel japanlife japanmusic jrock jpop citypop vinyljapan japan tokyonightlife; do
  turso db shell $DB "INSERT INTO SubredditTarget (id, name, enabled, createdAt, updatedAt, projectId) VALUES ('sub_mu_${sub}', '${sub}', 1, datetime('now'), datetime('now'), 'proj_music');"
done
echo "  Music subs added"

# Wild Meat Japan
for sub in japantravel japanlife hunting wildgame charcuterie butchery foraging cooking japanfood; do
  turso db shell $DB "INSERT INTO SubredditTarget (id, name, enabled, createdAt, updatedAt, projectId) VALUES ('sub_wm_${sub}', '${sub}', 1, datetime('now'), datetime('now'), 'proj_wildmeat');"
done
echo "  WildMeat subs added"

echo "=== Adding Keywords ==="

# JaCamp global keywords
turso db shell $DB "INSERT INTO KeywordFilter (id, keyword, enabled, isGlobal, createdAt, projectId) VALUES
  ('kw_jc_1', 'camping japan', 1, 1, datetime('now'), 'proj_jacamp'),
  ('kw_jc_2', 'camp japan', 1, 1, datetime('now'), 'proj_jacamp'),
  ('kw_jc_3', 'camping in japan', 1, 1, datetime('now'), 'proj_jacamp'),
  ('kw_jc_4', 'japan camping', 1, 1, datetime('now'), 'proj_jacamp'),
  ('kw_jc_5', 'glamping japan', 1, 1, datetime('now'), 'proj_jacamp'),
  ('kw_jc_6', 'fuji camping', 1, 1, datetime('now'), 'proj_jacamp'),
  ('kw_jc_7', 'hokkaido camping', 1, 1, datetime('now'), 'proj_jacamp'),
  ('kw_jc_8', 'japan outdoor', 1, 1, datetime('now'), 'proj_jacamp'),
  ('kw_jc_9', 'backpacking japan', 1, 1, datetime('now'), 'proj_jacamp'),
  ('kw_jc_10', 'hiking japan', 1, 1, datetime('now'), 'proj_jacamp'),
  ('kw_jc_11', 'wild camping japan', 1, 1, datetime('now'), 'proj_jacamp'),
  ('kw_jc_12', 'car camping japan', 1, 1, datetime('now'), 'proj_jacamp'),
  ('kw_jc_13', 'kumano kodo', 1, 1, datetime('now'), 'proj_jacamp'),
  ('kw_jc_14', 'japan trail', 1, 1, datetime('now'), 'proj_jacamp'),
  ('kw_jc_15', 'japan national park', 1, 1, datetime('now'), 'proj_jacamp'),
  ('kw_jc_16', 'jacamp', 1, 1, datetime('now'), 'proj_jacamp');"

# JaCamp contextual keywords
turso db shell $DB "INSERT INTO KeywordFilter (id, keyword, enabled, isGlobal, createdAt, projectId) VALUES
  ('kw_jc_c1', 'camping', 1, 0, datetime('now'), 'proj_jacamp'),
  ('kw_jc_c2', 'camp', 1, 0, datetime('now'), 'proj_jacamp'),
  ('kw_jc_c3', 'campsite', 1, 0, datetime('now'), 'proj_jacamp'),
  ('kw_jc_c4', 'tent', 1, 0, datetime('now'), 'proj_jacamp'),
  ('kw_jc_c5', 'hiking', 1, 0, datetime('now'), 'proj_jacamp'),
  ('kw_jc_c6', 'backpacking', 1, 0, datetime('now'), 'proj_jacamp'),
  ('kw_jc_c7', 'trekking', 1, 0, datetime('now'), 'proj_jacamp'),
  ('kw_jc_c8', 'outdoor', 1, 0, datetime('now'), 'proj_jacamp'),
  ('kw_jc_c9', 'outdoors', 1, 0, datetime('now'), 'proj_jacamp'),
  ('kw_jc_c10', 'nature', 1, 0, datetime('now'), 'proj_jacamp'),
  ('kw_jc_c11', 'national park', 1, 0, datetime('now'), 'proj_jacamp'),
  ('kw_jc_c12', 'onsen', 1, 0, datetime('now'), 'proj_jacamp'),
  ('kw_jc_c13', 'ryokan', 1, 0, datetime('now'), 'proj_jacamp'),
  ('kw_jc_c14', 'mountain hut', 1, 0, datetime('now'), 'proj_jacamp'),
  ('kw_jc_c15', 'glamping', 1, 0, datetime('now'), 'proj_jacamp');"

echo "  JaCamp keywords added"

# Music global keywords
turso db shell $DB "INSERT INTO KeywordFilter (id, keyword, enabled, isGlobal, createdAt, projectId) VALUES
  ('kw_mu_1', 'music japan', 1, 1, datetime('now'), 'proj_music'),
  ('kw_mu_2', 'japanese music', 1, 1, datetime('now'), 'proj_music'),
  ('kw_mu_3', 'japan concert', 1, 1, datetime('now'), 'proj_music'),
  ('kw_mu_4', 'live music japan', 1, 1, datetime('now'), 'proj_music'),
  ('kw_mu_5', 'tokyo music', 1, 1, datetime('now'), 'proj_music'),
  ('kw_mu_6', 'japan festival music', 1, 1, datetime('now'), 'proj_music'),
  ('kw_mu_7', 'japanese band', 1, 1, datetime('now'), 'proj_music'),
  ('kw_mu_8', 'j-rock', 1, 1, datetime('now'), 'proj_music'),
  ('kw_mu_9', 'j-pop', 1, 1, datetime('now'), 'proj_music'),
  ('kw_mu_10', 'city pop', 1, 1, datetime('now'), 'proj_music'),
  ('kw_mu_11', 'vinyl japan', 1, 1, datetime('now'), 'proj_music'),
  ('kw_mu_12', 'record shop japan', 1, 1, datetime('now'), 'proj_music'),
  ('kw_mu_13', 'jazz japan', 1, 1, datetime('now'), 'proj_music'),
  ('kw_mu_14', 'tokyo jazz', 1, 1, datetime('now'), 'proj_music'),
  ('kw_mu_15', 'fuji rock', 1, 1, datetime('now'), 'proj_music'),
  ('kw_mu_16', 'summer sonic', 1, 1, datetime('now'), 'proj_music'),
  ('kw_mu_17', 'music venue tokyo', 1, 1, datetime('now'), 'proj_music'),
  ('kw_mu_18', 'club japan', 1, 1, datetime('now'), 'proj_music');"

# Music contextual keywords
turso db shell $DB "INSERT INTO KeywordFilter (id, keyword, enabled, isGlobal, createdAt, projectId) VALUES
  ('kw_mu_c1', 'concert', 1, 0, datetime('now'), 'proj_music'),
  ('kw_mu_c2', 'live music', 1, 0, datetime('now'), 'proj_music'),
  ('kw_mu_c3', 'record shop', 1, 0, datetime('now'), 'proj_music'),
  ('kw_mu_c4', 'vinyl', 1, 0, datetime('now'), 'proj_music'),
  ('kw_mu_c5', 'jazz', 1, 0, datetime('now'), 'proj_music'),
  ('kw_mu_c6', 'music venue', 1, 0, datetime('now'), 'proj_music'),
  ('kw_mu_c7', 'club', 1, 0, datetime('now'), 'proj_music'),
  ('kw_mu_c8', 'festival', 1, 0, datetime('now'), 'proj_music'),
  ('kw_mu_c9', 'gig', 1, 0, datetime('now'), 'proj_music'),
  ('kw_mu_c10', 'band', 1, 0, datetime('now'), 'proj_music');"

echo "  Music keywords added"

# WildMeat global keywords
turso db shell $DB "INSERT INTO KeywordFilter (id, keyword, enabled, isGlobal, createdAt, projectId) VALUES
  ('kw_wm_1', 'hunting japan', 1, 1, datetime('now'), 'proj_wildmeat'),
  ('kw_wm_2', 'wild game japan', 1, 1, datetime('now'), 'proj_wildmeat'),
  ('kw_wm_3', 'wild meat japan', 1, 1, datetime('now'), 'proj_wildmeat'),
  ('kw_wm_4', 'venison japan', 1, 1, datetime('now'), 'proj_wildmeat'),
  ('kw_wm_5', 'boar japan', 1, 1, datetime('now'), 'proj_wildmeat'),
  ('kw_wm_6', 'deer japan', 1, 1, datetime('now'), 'proj_wildmeat'),
  ('kw_wm_7', 'gibier japan', 1, 1, datetime('now'), 'proj_wildmeat'),
  ('kw_wm_8', 'gibier', 1, 1, datetime('now'), 'proj_wildmeat'),
  ('kw_wm_9', 'japanese hunting', 1, 1, datetime('now'), 'proj_wildmeat'),
  ('kw_wm_10', 'matagi', 1, 1, datetime('now'), 'proj_wildmeat'),
  ('kw_wm_11', 'wild boar', 1, 1, datetime('now'), 'proj_wildmeat'),
  ('kw_wm_12', 'inoshishi', 1, 1, datetime('now'), 'proj_wildmeat'),
  ('kw_wm_13', 'shika', 1, 1, datetime('now'), 'proj_wildmeat'),
  ('kw_wm_14', 'japan hunting', 1, 1, datetime('now'), 'proj_wildmeat'),
  ('kw_wm_15', 'game meat japan', 1, 1, datetime('now'), 'proj_wildmeat');"

# WildMeat contextual keywords
turso db shell $DB "INSERT INTO KeywordFilter (id, keyword, enabled, isGlobal, createdAt, projectId) VALUES
  ('kw_wm_c1', 'hunting', 1, 0, datetime('now'), 'proj_wildmeat'),
  ('kw_wm_c2', 'wild game', 1, 0, datetime('now'), 'proj_wildmeat'),
  ('kw_wm_c3', 'wild meat', 1, 0, datetime('now'), 'proj_wildmeat'),
  ('kw_wm_c4', 'venison', 1, 0, datetime('now'), 'proj_wildmeat'),
  ('kw_wm_c5', 'boar', 1, 0, datetime('now'), 'proj_wildmeat'),
  ('kw_wm_c6', 'deer', 1, 0, datetime('now'), 'proj_wildmeat'),
  ('kw_wm_c7', 'game meat', 1, 0, datetime('now'), 'proj_wildmeat'),
  ('kw_wm_c8', 'foraging', 1, 0, datetime('now'), 'proj_wildmeat'),
  ('kw_wm_c9', 'wild food', 1, 0, datetime('now'), 'proj_wildmeat'),
  ('kw_wm_c10', 'butchery', 1, 0, datetime('now'), 'proj_wildmeat'),
  ('kw_wm_c11', 'charcuterie', 1, 0, datetime('now'), 'proj_wildmeat');"

echo "  WildMeat keywords added"

echo ""
echo "=== Verifying ==="
turso db shell $DB "SELECT name, slug, siteUrl FROM Project;"
turso db shell $DB "SELECT COUNT(*) as total_subs FROM SubredditTarget;"
turso db shell $DB "SELECT COUNT(*) as total_keywords FROM KeywordFilter;"

echo ""
echo "=== Done! Refresh the app ==="
