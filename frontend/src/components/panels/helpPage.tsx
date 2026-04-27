import { Colors } from "../common/colors";
import Logo from "../common/logo";
import HomeIcon from "../common/homeIcon";

const HelpPage = () => {
  return (
    <div>
      <div className="pl-[10vw] flex flex-col gap-2 pt-2">
        <Logo />
        <HomeIcon />
      </div>
      <div className="flex min-h-screen flex-col items-center pb-16 pt-6">
        <div
          className="shadow-[0_5px_10px_rgba(0,0,0,0.1)] rounded-2xl w-[80vw] h-[auto] p-8 overflow-y-auto"
          style={{ background: Colors.backgroundBeige }}
        >
          <h2
            className="text-2xl font-bold mb-4"
            style={{ color: Colors.blue }}
          >
            General information
          </h2>
          <p>
            RNAmoley is a web server designed for RNA analysis and refinement,
            enabling users to upload data and view results through RNA structure 
            visualizations in 2D and 3D. The application supports file formats 
            such as PDB (.pdb) and mmCIF (.mmCIF, .cif) as well as structure 
            identifiers (PDB ID). The primary goal of RNAmoley is to allow 
            RNA 3D structures assesment both globally and locally and provide 
            possibility to correct detected irregularities.
          </p>

          <h2
            className="text-2xl font-bold mt-6 mb-4"
            style={{ color: Colors.blue }}
          >
            RNAmoley workflow
          </h2>
          <p>After uploading data, the application follows these steps:</p>
          <ol className="list-decimal list-inside ml-6">
            <li>
              Input validation: Verifies the correctness of uploaded files or
              entered PDB ID.
            </li>
            <li>
              RNA structure processing: Prepares the data for visualization in
              2D and 3D formats.
            </li>
          </ol>
          <p>
            Next, the User can specify subject of analysis, by selecting a range of 
            residues of special interest and decide whether they want to analyze 
            the residues neighborhoods.
          </p>
          <p>
            After starting the analysis, the application generates a summary 
            of the results, and the User has the possibility to correct the structure
            by performing the refinement simulations. The results of simulations
            are then visualized in the same way as the uploaded structure.
          </p>

          <h2
            className="text-2xl font-bold mt-6 mb-4"
            style={{ color: Colors.blue }}
          >
            Input data preprocessing
          </h2>
          <p>
            RNAmoley applies the following rules during input data processing:
          </p>
          <ul className="list-disc list-inside ml-6">
            <li>
              Supported file formats include PDB (.pdb) and mmCIF (.mmCIF,
              .cif).
            </li>
            <li>The PDB ID must be a 4-character alphanumeric string.</li>
            <li>
              In multi-model files, the first model is analyzed by default.
              Users can switch to another model using options in the analysis
              panel
            </li>
            <li>Malformed data results in task rejection.</li>
          </ul>

          <h2
            className="text-2xl font-bold mt-6 mb-4"
            style={{ color: Colors.blue }}
          >
            How to use RNAmoley
          </h2>
          <div className="pl-4">
            <h3
              className="text-xl font-bold mt-5 mb-4"
              style={{ color: Colors.blue }}
            >
              Upload the structure
            </h3>
            <ol className="list-decimal list-inside ml-6">
              <li>
                Choose one of the three data input methods:
                <ul className="list-disc list-inside ml-6">
                  <li>
                    <b>Upload file</b> – Upload an RNA file in PDB or mmCIF
                    format.
                  </li>
                  <li>
                    <b>Fetch by PDB ID</b> – Enter a PDB structure identifier.
                  </li>
                  <li>
                    <b>Choose from samples</b> – Select an RNA structure from
                    provided examples.
                  </li>
                </ul>
              </li>
              <li>
                Ensure that the entered data meets the application’s
                requirements.
              </li>
              <li>
                Click the “Run” button, which becomes active after all data is
                correctly filled out.
              </li>
            </ol>

            <h3
              className="text-xl font-bold mt-5 mb-4"
              style={{ color: Colors.blue }}
            >
              Visualization and analysis
            </h3>

            <p>
              Once a task is submitted, users are redirected to the analysis
              panel, where they can review the RNA structure. Key panel features
              include:
            </p>
            <ul className="list-disc list-inside ml-6">
              <li>RNA structure visualization in 2D and 3D views.</li>
              <li>
                Toggle between views using a button in the top-right corner.
              </li>
            </ul>
            <br />

            <p>
              <b>Here are a few ways to select elements from structure:</b>
            </p>
            <div className="pl-4">
              <p>
                <b>Selecting Residues Individually:</b>
              </p>
              <ul className="list-disc list-inside ml-6">
                <li>
                  Click on residue's Index, Base or Secondary Structure cell in residues table to select it.
                </li>
              </ul>
              <p>
                <b>Selecting Structural Elements:</b>
              </p>
              <ul className="list-disc list-inside ml-6">
                <li>
                  Click on residue's Structural Element cell in residues table to select every structural element it belongs to.
                </li>
              </ul>
              <p>
                <b>Selecting Using the Range:</b>
              </p>
              <ul className="list-disc list-inside ml-6">
                <li>
                  Select the chain of interest then specify the index range
                  within which you want to select the structure.
                </li>
              </ul>
            </div>

            <h3
              className="text-xl font-bold mt-5 mb-4"
              style={{ color: Colors.blue }}
            >
              Configuration options
            </h3>
            <p>
              The analysis panel offers a sidebar menu on the left side of the
              analysis panel for changing model, managing secondary structure analysis 
              features, and setting parameters of analysis. It is divided
              into two tabs:
            </p>
            <ul className="list-disc ml-8">
              <li>
                <strong>Models</strong> - Switch between different models in multi-model 
                files for analysis.
              </li>
              <li>
                <strong>Settings</strong>
                <ul className="list-disc ml-6">
                  <li>
                    <strong>Fornac settings:</strong> Customize the RNA secondary
                    structure graph view to fit your preferences.
                  </li>
                  <li>
                    <strong>Neighborhood sphere</strong> - If <i>Analyze residue neighborhoods</i>
                    option was selected.
                    <ul className="list-disc ml-6">
                      <li>
                        <strong>Radius</strong> - Set the radius of the neighborhood sphere 
                        to define the area around selected residues (C1' atoms) for analysis.
                      </li>
                      <li>
                        <strong>Interval</strong> - Specify the interval for analyzing neighboring 
                        residues, determining how frequently the sphere are created around 
                        the selected residues.
                      </li>
                    </ul>
                  </li>
                </ul>
              </li>
            </ul>
            <h3
              className="text-xl font-bold mt-5 mb-4"
              style={{ color: Colors.blue }}
            >
              Graph customization - Fornac options
            </h3>
            <p>
              Enhance the visual experience in both Analysis and Result Panel
              with options like:
            </p>
            <ul className="list-disc ml-8">
              <li>
                <strong>Numbering, Label interval:</strong> Adjust node
                numbering and interval labels for easier navigation.
              </li>
              <li>
                <strong>Node Outline:</strong> Improves clarity by highlighting
                node boundaries.
              </li>
              <li>
                <strong>Node Label:</strong> Displays nucleotide symbols.
              </li>
              <li>
                <strong>Direction arrows:</strong> Display arrows indicating the direction of the RNA chain.
              </li>
              <li>
                <strong>Show connectivity:</strong> Toggle visibility of links between
                nucleotides.
              </li>
              <li>
                <strong>Animation:</strong> Adds dynamic behavior to the
                graph based on molecular forces.
              </li>
              <li>
                <strong>Show clashes:</strong> Only in Results Panel. Visualize steric clashes 
                between residues by drawing purple zigzag lines between them.
              </li>
              <li>
                Manipulate the graph's position, zoom using the scroll wheel, or
                reset with the "C" key.
              </li>
            </ul>

            <h3
              className="text-xl font-bold mt-5 mb-4"
              style={{ color: Colors.blue }}
            >
              Get analysis result
            </h3>
            <p>
              After selecting options and structure fragments, use the <i>Analyze</i>
              button to view the summary:
            </p>
            <ul className="list-disc ml-8">
              <li>
                View global results for the entire model and selected fragment of the structure.
              </li>
              <li>
                Check the metrics for each residue individually in the table. Use <i>Select Chain</i> to switch between chains.
              </li>
              <li>
                Visualize results in 2D and 3D, with colored quality measures. For neighborhood scores, 
                also the spheres are displayed in 3D view, colored by the same measure as the structure.
              </li>
              <li>Export analysis as a link or download all related files.</li>
            </ul>

            <h3
              className="text-xl font-bold mt-5 mb-4"
              style={{ color: Colors.blue }}
            >
              Structure coloring
            </h3>
            <p>Color visualised structure by chosen quality measure. Switch between different measures by on their names in residue table.</p>

            <h3
              className="text-xl font-bold mt-5 mb-4"
              style={{ color: Colors.blue }}
            >
              Export and Save
            </h3>
            <p>Export your work using buttons:</p>
            <ul className="list-disc ml-8">
              <li>
                <strong>Copy link to workspace:</strong> Generate a direct link
                to the analysis view.
              </li>
              <li>
                <strong>Download result files:</strong> Save all
                analysis-related files in a compressed folder.
              </li>
            </ul>
            <h3
              className="text-xl font-bold mt-5 mb-4"
              style={{ color: Colors.blue }}
            >
              Correcting the structure
            </h3>
            <p>To correct the structure, click <i>Correct the structure</i> button. The modal will appear with options for correction:</p>
            <ul className="list-disc ml-6">
              <li>
                <strong>Backbone restraint force</strong> (kcal/mol/Å²) - Adjust the strength of restraints 
                applied to the RNA backbone during refinement simulations, influencing how strongly the backbone 
                atoms will be pulled to their closest NtC conformations.
              </li>
              <li>
                <strong>Global restraint force</strong> (kcal/mol/Å²) - Set the strength of restraints applied to the entire structure, 
                affecting how strongly all atoms will be held to their original positions during refinement simulations.
              </li>
              <li>
                <strong>Base pairs restraint force</strong> (kcal/mol/Å²) - Adjust the strength of restraints applied to base pairs, 
                influencing how closely the base pairs will be pulled to ideal geometries of base pairing during refinement simulations.
              </li>
              <li>
                <strong>RMSD cutoff</strong> (Å) - Set the threshold for the root-mean-square deviation, 
                determining the maximum allowed deviation between the original and refined structure.
              </li>
            </ul>
            <p>Next, click <i>Start simulation</i> and wait for the simulation to complete. After the simulation is done,
            original and simulation results can be switched between below <i>Correct the structure</i> button.</p>
            <p className="mt-4"></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpPage;
