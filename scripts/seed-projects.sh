#!/bin/bash
BASE="http://localhost:3002"

echo "=== Creating Projects ==="

JACAMP=$(curl -s -X POST "$BASE/api/projects" -H "Content-Type: application/json" \
  -d '{"name":"JaCamp","slug":"jacamp","siteUrl":"jacamp.com","description":"Camping in Japan","color":"#16a34a"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo "JaCamp: $JACAMP"

MUSIC=$(curl -s -X POST "$BASE/api/projects" -H "Content-Type: application/json" \
  -d '{"name":"Music In Japan","slug":"musicinjapan","siteUrl":"musicinjapan.com","description":"Japanese music scene","color":"#7c3aed"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo "Music In Japan: $MUSIC"

WILDMEAT=$(curl -s -X POST "$BASE/api/projects" -H "Content-Type: application/json" \
  -d '{"name":"Wild Meat Japan","slug":"wildmeatjapan","siteUrl":"wildmeatjapan.com","description":"Wild game and hunting in Japan","color":"#dc2626"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo "Wild Meat Japan: $WILDMEAT"

echo ""
echo "=== Adding Subreddits ==="

# JaCamp subreddits
for sub in japantravel japantraveltips japanlife japanoutdoors camping backpacking hiking wildcamping overlanding solotravel; do
  curl -s -X POST "$BASE/api/subreddits" -H "Content-Type: application/json" \
    -d "{\"name\":\"$sub\",\"projectId\":\"$JACAMP\"}" > /dev/null
  echo "  JaCamp + r/$sub"
done

# Music In Japan subreddits
for sub in japantravel japanlife japanmusic jrock jpop citypop vinyljapan japan tokyonightlife; do
  curl -s -X POST "$BASE/api/subreddits" -H "Content-Type: application/json" \
    -d "{\"name\":\"$sub\",\"projectId\":\"$MUSIC\"}" > /dev/null
  echo "  Music + r/$sub"
done

# Wild Meat Japan subreddits
for sub in japantravel japanlife hunting wildgame charcuterie butchery foraging cooking japanfood; do
  curl -s -X POST "$BASE/api/subreddits" -H "Content-Type: application/json" \
    -d "{\"name\":\"$sub\",\"projectId\":\"$WILDMEAT\"}" > /dev/null
  echo "  WildMeat + r/$sub"
done

echo ""
echo "=== Adding Keywords ==="

# JaCamp keywords (global = match anywhere, contextual = Japan subs only)
for kw in "camping japan" "camp japan" "camping in japan" "japan camping" "glamping japan" "fuji camping" "hokkaido camping" "japan outdoor" "backpacking japan" "hiking japan" "wild camping japan" "car camping japan" "kumano kodo" "japan trail" "japan national park" "jacamp"; do
  curl -s -X POST "$BASE/api/keywords" -H "Content-Type: application/json" \
    -d "{\"keyword\":\"$kw\",\"projectId\":\"$JACAMP\",\"isGlobal\":true}" > /dev/null
done
for kw in camping camp campsite tent hiking backpacking trekking outdoor outdoors nature "national park" onsen ryokan "mountain hut" glamping; do
  curl -s -X POST "$BASE/api/keywords" -H "Content-Type: application/json" \
    -d "{\"keyword\":\"$kw\",\"projectId\":\"$JACAMP\",\"isGlobal\":false}" > /dev/null
done
echo "  JaCamp: keywords added"

# Music In Japan keywords
for kw in "music japan" "japanese music" "japan concert" "live music japan" "tokyo music" "japan festival music" "japanese band" "j-rock" "j-pop" "city pop" "vinyl japan" "record shop japan" "jazz japan" "tokyo jazz" "fuji rock" "summer sonic" "music venue tokyo" "club japan"; do
  curl -s -X POST "$BASE/api/keywords" -H "Content-Type: application/json" \
    -d "{\"keyword\":\"$kw\",\"projectId\":\"$MUSIC\",\"isGlobal\":true}" > /dev/null
done
for kw in concert "live music" "record shop" vinyl jazz "music venue" club festival gig band; do
  curl -s -X POST "$BASE/api/keywords" -H "Content-Type: application/json" \
    -d "{\"keyword\":\"$kw\",\"projectId\":\"$MUSIC\",\"isGlobal\":false}" > /dev/null
done
echo "  Music In Japan: keywords added"

# Wild Meat Japan keywords
for kw in "hunting japan" "wild game japan" "wild meat japan" "venison japan" "boar japan" "deer japan" "gibier japan" "gibier" "japanese hunting" "matagi" "wild boar" "inoshishi" "shika" "japan hunting" "game meat japan"; do
  curl -s -X POST "$BASE/api/keywords" -H "Content-Type: application/json" \
    -d "{\"keyword\":\"$kw\",\"projectId\":\"$WILDMEAT\",\"isGlobal\":true}" > /dev/null
done
for kw in hunting "wild game" "wild meat" venison boar deer "game meat" foraging "wild food" butchery charcuterie; do
  curl -s -X POST "$BASE/api/keywords" -H "Content-Type: application/json" \
    -d "{\"keyword\":\"$kw\",\"projectId\":\"$WILDMEAT\",\"isGlobal\":false}" > /dev/null
done
echo "  Wild Meat Japan: keywords added"

echo ""
echo "=== Done! ==="
echo "Open http://localhost:3002 to see your projects"
