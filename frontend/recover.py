import json
import subprocess

with open('/Users/suansh/.gemini/antigravity-ide/brain/f1d4aeb2-60dc-47ed-b96d-c0ca0be982d1/.system_generated/logs/transcript.jsonl') as f:
    lines = f.readlines()

content = subprocess.check_output(['git', 'show', 'HEAD:frontend/src/app/messaging/page.tsx']).decode('utf-8')

for line in lines:
    try:
        step = json.loads(line)
        if step.get('type') == 'PLANNER_RESPONSE':
            continue
        if step.get('tool_calls'):
            for tc in step['tool_calls']:
                args = tc.get('args', {})
                if tc['name'] == 'replace_file_content' and 'page.tsx' in args.get('TargetFile', ''):
                    content = content.replace(args['TargetContent'], args['ReplacementContent'])
                elif tc['name'] == 'multi_replace_file_content' and 'page.tsx' in args.get('TargetFile', ''):
                    for chunk in args.get('ReplacementChunks', []):
                        content = content.replace(chunk['TargetContent'], chunk['ReplacementContent'])
    except Exception as e:
        pass

with open('recovered_page.tsx', 'w') as f:
    f.write(content)
print("Done")
