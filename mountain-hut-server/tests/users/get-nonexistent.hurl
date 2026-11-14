GET {{base_url}}/api/v1/users
[QueryStringParams]
name: asdf
HTTP 404
[Asserts]
jsonpath "$.message" == "User Not Found"
