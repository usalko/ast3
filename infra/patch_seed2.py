p='/app/seed_demo.py'
with open(p,'r',encoding='utf-8') as f:
    s=f.read()
old='''users = {
    "dev1": User.objects.get_or_create(
        email="dev1@test.local", password="admin123",
        first_name="Иван", last_name="Петров", patronymic="",
        department=department_by_code["DEV"],
    ),
    "dev2": User.objects.get_or_create(
        email="dev2@test.local", password="admin123",
        first_name="Мария", last_name="Сидорова", patronymic="",
        department=department_by_code["DEV"],
    ),
    "mfg1": User.objects.get_or_create(
        email="mfg1@test.local", password="admin123",
        first_name="Алексей", last_name="Кузнецов", patronymic="",
        department=department_by_code["MFG"],
    ),
    "ops1": User.objects.get_or_create(
        email="ops1@test.local", password="admin123",
        first_name="Елена", last_name="Смирнова", patronymic="",
        department=department_by_code["OPS"],
    ),
}'''
new='''users = {
    "dev1": User.objects.get_or_create(
        email="dev1@test.local",
        defaults={"password": "admin123", "first_name": "Иван", "last_name": "Петров", "patronymic": "", "department": department_by_code["DEV"]},
    )[0],
    "dev2": User.objects.get_or_create(
        email="dev2@test.local",
        defaults={"password": "admin123", "first_name": "Мария", "last_name": "Сидорова", "patronymic": "", "department": department_by_code["DEV"]},
    )[0],
    "mfg1": User.objects.get_or_create(
        email="mfg1@test.local",
        defaults={"password": "admin123", "first_name": "Алексей", "last_name": "Кузнецов", "patronymic": "", "department": department_by_code["MFG"]},
    )[0],
    "ops1": User.objects.get_or_create(
        email="ops1@test.local",
        defaults={"password": "admin123", "first_name": "Елена", "last_name": "Смирнова", "patronymic": "", "department": department_by_code["OPS"]},
    )[0],
}'''
s=s.replace(old,new)
with open(p,'w',encoding='utf-8') as f:
    f.write(s)
print('patched users block')
