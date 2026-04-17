# --- USTAWIENIA ---
set psf_file <psf_file>
set dcd_file <dcd_file>
set reference_file <reference_file>
set threshold <threshold>
set rmsd_selection <rmsd_selection>
set export_selection <export_selection>
set out_pdb <out_pdb>
set align <align>

# --- WCZYTYWANIE TRAJEKTORII ---
mol new $psf_file type psf waitfor all
mol addfile $dcd_file type dcd waitfor all
set traj_mol [molinfo top]

# --- REFERENCJA ---
if {[string length $reference_file] > 0} {
    mol new $reference_file waitfor all
    set ref_mol [molinfo top]
} else {
    set temp_reference "__temp_reference_from_frame0.pdb"
    set ref_export_sel [atomselect $traj_mol $rmsd_selection frame 0]
    $ref_export_sel writepdb $temp_reference
    $ref_export_sel delete

    mol new $temp_reference waitfor all
    set ref_mol [molinfo top]
}

set ref_sel [atomselect $ref_mol $rmsd_selection]
set num_ref [$ref_sel num]

set num_frames [molinfo $traj_mol get numframes]
set found_frame -1
set last_frame [expr {$num_frames - 1}]
set last_rmsd 0.0

puts "START threshold=$threshold frames=$num_frames"

for {set frame 0} {$frame < $num_frames} {incr frame} {
    set fit_sel [atomselect $traj_mol $rmsd_selection frame $frame]

    if {[$fit_sel num] != $num_ref} {
        puts "ERROR selection size mismatch at frame $frame: [$fit_sel num] vs $num_ref"
        $fit_sel delete
        $ref_sel delete
        if {[file exists "__temp_reference_from_frame0.pdb"]} {
            file delete -force "__temp_reference_from_frame0.pdb"
        }
        exit 1
    }

    if {$align} {
        set transform [measure fit $fit_sel $ref_sel]
        $fit_sel move $transform
    }

    set current_rmsd [measure rmsd $fit_sel $ref_sel]
    set last_frame $frame
    set last_rmsd $current_rmsd

    $fit_sel delete

    if {$current_rmsd > $threshold} {
        set found_frame $frame

        set export_sel [atomselect $traj_mol $export_selection frame $frame]
        $export_sel writepdb $out_pdb
        $export_sel delete

        puts "FOUND frame=$frame rmsd=[format %.4f $current_rmsd] output=$out_pdb"
        break
    }
}

$ref_sel delete

if {$found_frame < 0} {
    set export_sel [atomselect $traj_mol $export_selection frame $last_frame]
    $export_sel writepdb $out_pdb
    $export_sel delete

    puts "LAST frame=$last_frame rmsd=[format %.4f $last_rmsd] output=$out_pdb"
} else {
    puts "FOUND frame=$found_frame rmsd=[format %.4f $current_rmsd] output=$out_pdb"
}

if {[file exists "__temp_reference_from_frame0.pdb"]} {
    file delete -force "__temp_reference_from_frame0.pdb"
}

exit