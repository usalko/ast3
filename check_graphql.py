import urllib.request, json

for pid in ["4", "5"]:
    query = 'query{tasks(projectId: "%s"){id title code assignees{id fullName position} status{name}}}' % pid
    data = json.dumps({'query': query}).encode()
    req = urllib.request.Request('http://localhost:8000/graphql/', data=data, headers={'Content-Type': 'application/json'})
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read())
    if 'errors' in result:
        print(f"\n=== Project {pid} ERRORS ===")
        print(result['errors'])
        continue
    tasks = result.get('data', {}).get('tasks', [])
    print(f"\n=== Project {pid} ({len(tasks)} tasks) ===")
    for t in tasks:
        assigns = t.get('assignees', [])
        print(f"  Task {t['id']} {t.get('code','')}: {t['title'][:25]:25s} -> assignees: {[(a.get('fullName'), a.get('position')) for a in assigns]}")
