curl --location 'localhost:3000/api/v1/jobs' \
--header 'Content-Type: multipart/form-data' \
--header 'Accept: multipart/form-data' \
--form 'rnaFile=' \
--form 'jobName="code_test"' \
--form 'pdbCode="7kuc"' \
--form 'radioButton='