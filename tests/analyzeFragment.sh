curl --location --globoff 'localhost:3000/api/v1/jobs/analyzeFragment' \
--header 'Content-Type: application/json' \
--data '{
    "id": "80590c36-2346-4b0f-b277-8c88a516227f",
    "residues": [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]
}'