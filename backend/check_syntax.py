import ast, os
errors = []
count = 0
for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in ['__pycache__','.git','venv']]
    for f in files:
        if f.endswith('.py'):
            fp = os.path.join(root, f)
            count += 1
            try:
                src = open(fp, encoding='utf-8').read()
                ast.parse(src)
            except SyntaxError as e:
                errors.append(f'{fp}: {e}')
            except Exception as e:
                errors.append(f'{fp}: read error {e}')
if errors:
    print('SYNTAX ERRORS:')
    for e in errors:
        print(e)
else:
    print(f'All {count} Python files passed AST check')
