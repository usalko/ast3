import requests, json

r = requests.post("http://localhost:8000/graphql/", json={"query": "mutation{tokenObtainPair(email:\"admin@test.local\",password:\"admin123\"){access}}"})
token = r.json()["data"]["tokenObtainPair"]["access"]

for pid in ["2", "5"]:
    r2 = requests.post("http://localhost:8000/graphql/", json={"query": "query($pid:ID!){tasks(projectId:$pid){id code title assignee{id firstName lastName fullName} assignees{id firstName lastName fullName}} project(id:$pid){id code name}}", "variables": {"pid": pid}}, headers={"Authorization": f"Bearer {token}"})
    data = r2.json()
    print(f"\n=== Project {data['data']['project']} ===")
    for t in data["data"]["tasks"][-2:]:
        print(f"  Task: {t['code']} {t['title']}")
        print(f"    assignee (FK): {t['assignee']}")
        print(f"    assignees (M2M): {t['assignees']}")
