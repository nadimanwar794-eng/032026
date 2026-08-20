import re

files_to_update = [
    './artifacts/iic-study-app/src/components/RevisionHubScreen.tsx',
    './artifacts/iic-study-app/src/components/TodayRevisionView.tsx'
]

for filepath in files_to_update:
    with open(filepath, 'r') as f:
        content = f.read()

    # The original replace script did not change the usages in those files due to regex mis-matches on `<br\/?\>` etc
    # We will just remove the imports.
    content = content.replace("import McqQuestionDisplay from './McqQuestionDisplay';\n", "")

    with open(filepath, 'w') as f:
        f.write(content)

print("Unused imports removed.")
