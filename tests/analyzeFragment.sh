curl --location --globoff 'localhost:3000/api/v1/jobs/analyzeFragment' \
--header 'Content-Type: application/json' \
--data '{
    "id": "7c880919-c3b3-428a-ba80-0fd646a8690c",
    "residues": [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]
}'