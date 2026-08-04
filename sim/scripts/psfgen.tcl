package require psfgen

# Load topologies for protein and RNA residues
# Protein force field first, then RNA force field
topology /webserver/scripts/amber/ff99SBildn/ff99SBildn.rtf
topology /webserver/scripts/amber/OL3/OL3.rtf

# Load water/ion topology definitions
# This file contains water residue names such as TP3 and WAT
topology /webserver/scripts/amber/solvents/tip3p_ions.str

# Map common PDB residue names to topology definitions
pdbalias residue HIS HID
pdbalias residue HSD HID
pdbalias residue HSE HID
pdbalias residue HSP HID
pdbalias residue HOH WAT
pdbalias residue WAT WAT
pdbalias residue TP3 WAT

pdbalias atom G O1P OP1
pdbalias atom G O2P OP2
pdbalias atom A O1P OP1
pdbalias atom A O2P OP2
pdbalias atom C O1P OP1
pdbalias atom C O2P OP2
pdbalias atom U O1P OP1
pdbalias atom U O2P OP2

<segment_blocks>

regenerate angles dihedrals  

guesscoord

writepsf output.psf
writepdb output.pdb

# setting Beta for heavy atoms
mol new output.psf
mol addfile output.pdb

set all [atomselect top all]
$all set beta 0

set heavy [atomselect top "noh"]
$heavy set beta 1

$all writepdb output.pdb
mol delete top

exit