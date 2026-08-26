# RNAmoley

## Usage

1. Prepare .env for restapi basing on .env.example
2. Download and provide to sim directory, NAMD and VMD archives from official source. Preffered version are NAMD_3.0.2_Linux-x86_64-multicore and vmd-1.9.3.bin.LINUXAMD64.text.
3. Start containers
```bash
docker compose up --build
```

## References
NtC templates: 
1. J. Černý, M. Malý, P. Božíková, T. Prchalová, J. Svoboda, L. Biedermannová, B. Schneider, Dnatco v5.0: integrated web platform for 3d
nucleic acid structure analysis, Nucleic Acids Research 54 (2026) gkaf1491. https://dx.doi.org/10.1093/nar/gkaf149

Base pair templates: 
1. X.-J. Lu, H. J. Bussemaker, W. K. Olson, Dssr: An integrated software tool for dissecting the spatial structure of rna, Nucleic Acids Research
43 (2015) e142. https://dx.doi.org/10.1093/nar/gkv716.
2. C. L. Lawson, H. M. Berman, B. Vallat, L. Chen, C. L. Zirbel, The nucleic acid knowledgebase: a new portal for 3d structural information
about nucleic acids, Nucleic Acids Research 52 (2024) D245–D254. https://dx.doi.org/10.1093/nar/gkad957.

Amber force field for NAMD:
1. Antolínez S, Jones PE, Phillips JC, Hadden-Perilla JA AMBERff at Scale: Multimillion-Atom Simulations with AMBER Force Fields in NAMD, Journal of Chemical Information and Modeling 64, 2, 543-554 (2024) https://dx.doi.org/10.1021/acs.jcim.3c01648.
