import re, sys
src, dst, need = sys.argv[1], sys.argv[2], sys.argv[3]
t = open(src, encoding='utf-8').read()
head, *hunks = re.split(r'(?m)^(?=@@ )', t)
keep = [h for h in hunks if need in h]
assert len(keep) == 1, (len(hunks), len(keep))
open(dst, 'w', encoding='utf-8', newline='').write(head + ''.join(keep))
print('kept 1 of', len(hunks))
