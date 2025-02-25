curl --location 'localhost:3000/api/v1/jobs' \
--header 'Content-Type: multipart/form-data' \
--header 'Accept: multipart/form-data' \
--form 'rnaFile=@"/home/dawid/RNAmoley/tests/models.pdb"' \
--form 'jobName="many_models_file_test"' \
--form 'pdbCode=' \
--form 'radioButton='