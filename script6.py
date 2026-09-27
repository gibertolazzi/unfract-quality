import os

constants_file = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/constants.ts'
with open(constants_file, 'r') as f:
    content = f.read()

content = content.replace("export {", "export type {")

with open(constants_file, 'w') as f:
    f.write(content)
