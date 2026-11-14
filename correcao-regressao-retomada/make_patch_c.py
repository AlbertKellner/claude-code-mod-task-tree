import re, sys
src, dst, drop = sys.argv[1], sys.argv[2], sys.argv[3]
t = open(src, encoding='utf-8').read()
head, *hunks = re.split(r'(?m)^(?=@@ )', t)
keep = [h for h in hunks if drop not in h]
assert len(keep) == len(hunks) - 1, (len(hunks), len(keep))
open(dst, 'w', encoding='utf-8', newline='').write(head + ''.join(keep))
print('patch ok:', len(keep), 'hunks kept of', len(hunks))
