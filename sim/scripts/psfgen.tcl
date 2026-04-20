package require psfgen
topology /webserver/scripts/amber/OL3/OL3.rtf

pdbalias atom G O1P OP1
pdbalias atom G O2P OP2
pdbalias atom A O1P OP1
pdbalias atom A O2P OP2
pdbalias atom C O1P OP1
pdbalias atom C O2P OP2
pdbalias atom U O1P OP1
pdbalias atom U O2P OP2

segment <segment> {
    pdb <input>
}

coordpdb <input> <segment>

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