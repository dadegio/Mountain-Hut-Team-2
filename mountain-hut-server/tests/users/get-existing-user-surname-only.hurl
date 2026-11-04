GET {{base_url}}/api/v1/users
[QueryStringParams]
surname: Neri
HTTP 200
[Asserts]
jsonpath "$[0].email" == "luca.neri@example.com"
jsonpath "$[0].name" == "Luca"
jsonpath "$[0].surname" == "Neri"
