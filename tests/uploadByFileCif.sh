curl --location 'localhost:3000/api/v1/jobs' \
--header 'Content-Type: multipart/form-data' \
--header 'Accept: multipart/form-data' \
--form 'rnaFile=@"/home/dawid/RNAmoley/tests/7KUC_1_A.cif"' \
--form 'jobName="file_test"' \
--form 'pdbCode=' \
--form 'radioButton='