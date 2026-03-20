import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'Backend'))

from services.matching_service import names_match

def test(n1, n2):
    res = names_match(n1, n2)
    print(f"names_match('{n1}', '{n2}') -> {res}")

test("MILK", "abc")
test("milk", "abc")
test("milk", "milk product")
test("abc", "abc product")
test("milk", "onestop")
