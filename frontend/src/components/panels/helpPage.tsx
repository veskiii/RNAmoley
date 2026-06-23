import { Colors } from "../common/colors";
import Logo from "../common/logo";
import HomeIcon from "../common/homeIcon";
import Footer from "../common/footerComponent";

const HelpPage = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="sticky top-0 bg-white flex flex-row gap-2 pt-2 justify-between pr-10 pb-2 shadow-bottom">
        <Logo />
        <HomeIcon />
      </div>
      <div className="flex flex-1 flex-col items-center pb-16 pt-6">
        <div
          className="border border-gray-100 shadow-md rounded p-8 w-[80vw] h-[auto] max-w-5xl overflow-y-auto text-justify"
        >
          {/* Table of Contents */}
          <div className="mb-8 p-4 bg-gray-50 rounded border-l-4" style={{ borderLeftColor: Colors.blue }}>
            <h3 className="text-lg font-bold mb-3" style={{ color: Colors.blue }}>
              Table of Contents
            </h3>
            <ul className="space-y-2">
              <li>
                <a href="#general-info" className="hover:underline" style={{ color: Colors.blue }}>
                  General information
                </a>
              </li>
              <li>
                <a href="#how-to-use" className="hover:underline" style={{ color: Colors.blue }}>
                  How to use RNAmoley?
                </a>
              </li>
              <ul className="ml-4 space-y-1">
                <li>
                  <a href="#input" className="hover:underline" style={{ color: Colors.blue }}>
                    Input data
                  </a>
                </li>
                <ul className="ml-4 space-y-1">
                  <li>
                    <a href="#upload" className="hover:underline" style={{ color: Colors.blue }}>
                      Upload the structure
                    </a>
                  </li>
                  <li>
                    <a href="#local-analysis" className="hover:underline" style={{ color: Colors.blue }}>
                      Local analysis
                    </a>
                  </li>
                </ul>
                <li>
                  <a href="#specify-region" className="hover:underline" style={{ color: Colors.blue }}>
                    Specify region for analysis
                  </a>
                </li>
                <ul className="ml-4 space-y-1">
                  <li>
                    <a href="#select-models" className="hover:underline" style={{ color: Colors.blue }}>
                      Select models
                    </a>
                  </li>
                  <li>
                    <a href="#select-chains" className="hover:underline" style={{ color: Colors.blue }}>
                      Select chains
                    </a>
                  </li>
                  <li>
                    <a href="#select-region" className="hover:underline" style={{ color: Colors.blue }}>
                      Select region
                    </a>
                  </li>
                </ul>
                <li>
                  <a href="#analysis-results" className="hover:underline" style={{ color: Colors.blue }}>
                    Analysis results
                  </a>
                </li>
                <ul className="ml-4 space-y-1">
                  <li>
                    <a href="#saving-results" className="hover:underline" style={{ color: Colors.blue }}>
                      Saving results
                    </a>
                  </li>
                  <li>
                    <a href="#run-refinement" className="hover:underline" style={{ color: Colors.blue }}>
                      Run refinement
                    </a>
                  </li>
                  <li>
                    <a href="#global-quality-summary" className="hover:underline" style={{ color: Colors.blue }}>
                      Global quality summary
                    </a>
                  </li>
                  <li>
                    <a href="#refinement-statistics" className="hover:underline" style={{ color: Colors.blue }}>
                      Refinement statistics
                    </a>
                  </li>
                  <li>
                    <a href="#local-quality-table" className="hover:underline" style={{ color: Colors.blue }}>
                      Local quality table
                    </a>
                  </li>
                  <li>
                    <a href="#local-quality-charts" className="hover:underline" style={{ color: Colors.blue }}>
                      Local quality charts
                    </a>
                  </li>
                  <li>
                    <a href="#structure-visualization" className="hover:underline" style={{ color: Colors.blue }}>
                      Structure visualization (2D and 3D)
                    </a>
                  </li>
                </ul>
              </ul>
              <li>
                <a href="#system-requirements" className="hover:underline" style={{ color: Colors.blue }}>
                  System requirements
                </a>
              </li>
            </ul>
          </div>

          <h2
            id="general-info"
            className="text-2xl font-bold mb-4 scroll-mt-16"
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
            id="how-to-use"
            className="text-2xl font-bold mt-6 mb-4 scroll-mt-16"
            style={{ color: Colors.blue }}
          >
            How to use RNAmoley?
          </h2>
            <p>
              General workflow of using RNAmoley consists of these main steps:
            </p>
            <ol className="list-decimal list-inside ml-3">
              <li>Upload the structure and specify type of analysis (only global or local analysis).</li>
              <li>Specify models and region of interest for the analysis.</li>
              <li>Browse the results and analyze the structure.</li>
              <li>(Optional) Refine the structure and reanalyze results.</li>
            </ol>
          <div className="ml-3">
            <h3
              id="input"
              className="text-xl font-bold mt-5 mb-4 scroll-mt-16"
              style={{ color: Colors.blue }}
            >
              Input data
            </h3>
            <p>
              To start using RNAmoley, users need to provide file for analysis and specify the type of analysis.
              Provided file can consists of one or more models and chains. There is no limitation for the number 
              of models and chains in the file. Also, there is no limitation for the number of residues in the file, 
              but it should be noted that the larger the file, the longer the analysis will take. If selected model
              contains any non-RNA residues, they will be ignored in the analysis. For the type of analysis, users 
              can enable local analysis, which will provide quality scores for each residue and its neighborhood,
              or disable it to get only global quality scores for the entire structure. Furthermore, users can specify
              the radius of the neighborhood sphere.
            </p>
            <div className="ml-3">
              <h4
                id="upload"
                className="text-lg font-bold mt-4 mb-2 scroll-mt-16"
                style={{ color: Colors.blue }}
              >
                Upload the structure
              </h4>
              <ol className="list-decimal list-inside ml-3">
                <li>
                  Choose one of the three data input methods:
                  <ul className="list-disc list-inside ml-3">
                    <li>
                      <b>Upload file</b> - Upload an RNA file in PDB or mmCIF
                      format.
                    </li>
                    <li>
                      <b>Fetch by PDB ID</b> - Enter a PDB structure identifier (classic 4-character code or newer 12-character code).
                    </li>
                    <li>
                      <b>Choose from samples</b> - Select an RNA structure from
                      preloaded examples based on RNA-Puzzles and CASP15 submissions.
                    </li>
                  </ul>
                </li>
                <li>
                  Specify the type of analysis by checking the box for local analysis and setting the radius 
                  of neighborhood sphere if local analysis is enabled. By default, local analysis is enabled
                  and the radius of neighborhood sphere is set to 5 Å.
                </li>
                <li>
                  Click the <i>Next</i> button, which becomes active after all data is
                  correctly filled out. Alternatively, click <i>Reset settings</i> to clear all fields and start over.
                </li>
              </ol>
              <h4
                id="local-analysis"
                className="text-xl font-bold mt-5 mb-4 scroll-mt-16"
                style={{ color: Colors.blue }}
              >
                Local analysis
              </h4>
              <p>
                Local analysis provides detailed quality scores for each residue and its neighborhood. 
                The neighborhood is defined by a sphere with a user-specified radius, centered on 
                the C1' atoms of the selected residues. Each residue that at least one atom is located
                within the sphere is considered part of the neighborhood. Enabling local analysis 
                provides users clash scores, bad bonds and bad angles scores for each residue and its neighborhood, 
                while disabling it only provides suiteness and sugar pucker outlier types (also included in local analysis).
              </p>
            </div>
            <h3
              id="specify-region"
              className="text-xl font-bold mt-5 mb-4 scroll-mt-16"
              style={{ color: Colors.blue }}
            >
              Specify region for analysis
            </h3>
            <p>
              Once a task is submitted, users are redirected to the region selection
              panel, where they can specify the region of interest for analysis and visualization. 
              The panel provides an interactive 2D graph of the RNA structure and a table with residues 
              information. At the top of the panel, users can find <i>Input data defined in previous steps</i>,
              which displays the name of the uploaded file, specified radius of the neighborhood sphere,
              and the information whether the file contains any non-RNA residues (if they are present).
            </p>
            <div className="ml-3">
              <h4
                id="select-models"
                className="text-lg font-bold mt-4 mb-2 scroll-mt-16"
                style={{ color: Colors.blue }}
              >
                Select models
              </h4>
              <p>
                If the uploaded file contains multiple models, use the <i>Select model(s)</i> section 
                to switch between them. Underneath the model selection, user can find <i>Model visualization</i>, 
                after clicking <i>Show</i> button, the 2D and 3D views will display the structure of the selected model.
                Selected region of the model is highlighted in green for easy identification.
              </p> 
              <br />
              <p>
                The <b>3D view</b> is interactive, allowing users to rotate, zoom, and pan the structure for a better understanding
                of the spatial arrangement of the selected region. To learn more about the 3D view controls, refer to the
                {' '}<a href="https://molstar.org/viewer-docs/" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: Colors.blue }}>Mol* Viewer Documentation</a>.
              </p>
              <br />
              <p>
                The <b>2D view</b> also allows users to interactively explore the structure, with options to zoom in and out.
                By clicking ⚙️ button, users can access additional settings to customize the 2D view, such as adjusting 
                the numbering, outline and labeling of the nodes.
              </p>
              <h4
                id="select-chains"
                className="text-lg font-bold mt-4 mb-2 scroll-mt-16"
                style={{ color: Colors.blue }}
              >
                Select chains
              </h4>
              <p>
                If the selected model contains multiple chains, use the <i>Select chain(s)</i> section
                to switch between them. The sequence of the selected chain is displayed in the residues 
                table below for region selection.
              </p>
              <h4
                id="select-region"
                className="text-lg font-bold mt-4 mb-2 scroll-mt-16"
                style={{ color: Colors.blue }}
              >
                Select region
              </h4>
              <p>
                To specify the region of interest for analysis, users can select residues from the residues table. 
                There are several ways to select residues:
              </p>
              <ul className="list-disc list-inside ml-3">
                <li>
                  <b>Individually:</b> Click on residue's Index, Base or Secondary Structure cell 
                  in residues table to select it.
                </li>
                <li>
                  <b>Structural Elements:</b> Click on residue's Structural Element cell in residues 
                  table to select every residue that belongs to one of the structural elements it belongs 
                  to (e.g., if residue is part of a hairpin loop, all residues in that hairpin loop will be selected).
                </li>
                <li>
                  <b>Using the Range:</b> Specify the index range within which you want to select the region.
                </li>
              </ul>
              <p>
                In the <i>Selection summary</i>, users can see a summary of the selected residues, structural elements,
                and ranges for every chain and model. To discard the selection, click the <i>Clear all</i> button, 
                which will clear all selected residues and ranges. To discard only the specific selection range, 
                click <i>X</i> button next to the range in the <i>Selection summary</i>.
              </p>
            </div>
            <br />
            <p>
              After the selection is made, users should click the <i>Run analysis</i> button to proceed to the results panel. 
              The button will be enabled only if at least one residue is selected.
            </p>

            <h3
              id="analysis-results"
              className="text-xl font-bold mt-5 mb-4 scroll-mt-16"
              style={{ color: Colors.blue }}
            >
              Analysis results
            </h3>
            <p>
              After the analysis is completed, users are redirected to the results panel, 
              where they can view the results of the analysis. Similarly to the previous panel,
              at the top of the panel, users can find <i>Input data defined in previous steps</i>,
              which displays the name of the uploaded file, specified radius of the neighborhood sphere,
              the information whether the file contains any non-RNA residues (if they are present)
              and also selected region for each selected model.
            </p>
            <p>
              Users can also switch between different models and chains to view the results for the selected region.
            </p>
            <div className="ml-3">
              <h4
                id="saving-results"
                className="text-lg font-bold mt-4 mb-2 scroll-mt-16"
                style={{ color: Colors.blue }}
              >
                Saving results
              </h4>
              <p>
                Users can save the results of the analysis by clicking the <i>Copy link</i> button, 
                which will copy to clipboard a direct link to the analysis view. It is the same link as seen in 
                the browser's address bar. The results are available for 14 days from the date of analysis,
                after which they will be deleted from the server.
              </p>
              <p>
                Alternatively, users can click the <i>Download results</i> button to 
                download all analysis-related files, charts and 2D views in a compressed folder.
              </p>
              <h4
                id="run-refinement"
                className="text-xl font-bold mt-5 mb-4 scroll-mt-16"
                style={{ color: Colors.blue }}
              >
                Run refinement
              </h4>
              <p>
                To correct the structure, click the <i>Run refinement</i> button. This will perform an energy
                minimization using the Amber force field with some modifications. In addition, some restraints 
                can be applied to ensure that specific structural features are less prone to distortions due 
                to the energy minimization.
              </p>
              <p>The modal will appear with options for correction:</p>
              <ul className="list-disc ml-3">
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
                  <strong>Base pairs restraint force</strong> (kcal/mol/Å²) - Adjust the strength of restraints applied to canonical base pairs, 
                  influencing how closely the base pairs will be pulled to ideal geometries of base pairing during refinement procedure.
                </li>
                <li>
                  <strong>RMSD cutoff</strong> (Å) - Set the threshold for the root-mean-square deviation, 
                  determining the maximum allowed deviation between the original and refined structure.
                </li>
              </ul>
              <p>Next, click <i>Run refinement</i> and wait for the simulation to complete. After the simulation is done,
              refinement results will appear automatically on graphs and in tables, coloring of the structure in 2D view can be switched above those views.
              Moreover, check <i>Show 3D alignment</i> box to view both original and refined structures in 3D view.</p>
              <br />
              <p>
                It should be noted that the refinement feature is currently available only for the files that 
                do not contain any non-RNA residues.
              </p>
              <h4
                id="global-quality-summary"
                className="text-xl font-bold mt-5 mb-4 scroll-mt-16"
                style={{ color: Colors.blue }}
              >
                Global quality summary
              </h4>
              <p>
                The global quality summary provides an overview of the quality scores for the entire model
                and selected region of the model. It includes metrics such as clash score, bad bonds, bad angles, 
                suite outliers, and sugar pucker outliers.
              </p>
              <p>
                In this section the <b>RNAmoley Quality Score (RQS)</b> is also displayed. The RQS summarizes the overall
                distribution of errors in the structure. It is calculated as the average of the percentages
                of residues containing each type of irregularity (clashes, bad bonds, bad angles, suite outliers and sugar pucker outliers) 
                and the percentage of clean residues (without any irregularities). The score ranges from 0 to 1, 
                where 0 indicates a structure with defects in each residue and 1 indicates a structure 
                with no deviations. The score is calculated for the entire model and for the selected region of the model, 
                allowing users to compare the quality of different regions of the structure.
              </p>
              <h4
                id="refinement-statistics"
                className="text-xl font-bold mt-5 mb-4 scroll-mt-16"
                style={{ color: Colors.blue }}
              >
                Refinement statistics
              </h4>
              <p>
                The <i>Refinement statistics</i> section presents detailed comparisons of quality scores before 
                and after the refinement process.
              </p>
              <p>
                The first table contains the parameters used for the refinement process, including the backbone 
                restraint force, global restraint force, base pairs restraint force, and RMSD cutoff.
              </p>
              <p>
                The <i>Entire models metrics</i> table displayes the quality scores before, after and the difference
                between them for the entire model. Similarly, <i>Analysed region metrics</i> table shows the same
                information, but in regard to the selected region of the model.
              </p>
              <p>
                The <i>Refinement impact on the analysed region</i> table describes how many residues in the 
                selected region have improved, worsened or remained unchanged after the refinement process.
                Also, the mean change for each quality score is displayed.
              </p>
              <p>
                <i>Detailed refinement metrics for the analysed region</i> allows users to dive deeper into
                the refinement results by providing a breakdown of largest, least, mean and median improvements 
                and deteriorations for each quality score in the selected region.
              </p>

              <h4
                id="local-quality-table"
                className="text-xl font-bold mt-5 mb-4 scroll-mt-16"
                style={{ color: Colors.blue }}
              >
                Local quality table
              </h4>
              <p>
                The local quality table provides a detailed breakdown of quality scores for each residue and its neighborhood. 
                Clash score, bad bonds and bad angles are calculated for each selected residue's neighborhood, while suiteness 
                and sugar pucker outliers are properties of the residue itself.
              </p>
              <p>
                If user has run refinement, the table also displays the quality scores before and after the refinement process.
              </p>
              <h4
                id="local-quality-charts"
                className="text-xl font-bold mt-5 mb-4 scroll-mt-16"
                style={{ color: Colors.blue }}
              >
                Local quality charts
              </h4>
              <p>
                The local quality charts provide visual representations of the quality scores for each residue 
                and its neighborhood. Users can easily identify trends and patterns in the data, allowing for 
                a more intuitive understanding of the structure's quality. Charts are displayed for each 
                metric-based quality scores, including clash score, bad bonds, bad angles and suiteness.
                Values for original model are displayed in orange, while values for refined model are displayed in blue.
                On the X-axis, the residue index, RNA base and secondary structure are displayed, while on the Y-axis, 
                the quality score values.
              </p>
              <p>
                To save the chart, user should click ⬇️ button in the top left corner of the chart, which will download 
                the chart as a PNG image.
              </p>
              <h4
                id="structure-visualization"
                className="text-xl font-bold mt-5 mb-4 scroll-mt-16"
                style={{ color: Colors.blue }}
              >
                Structure visualization (2D and 3D)
              </h4>
              <p>
                The structure visualization section provides interactive 2D and 3D views of the RNA structure. 
                Users can explore the spatial arrangement of the selected region, rotate, zoom, 
                and pan the structure for a better understanding. Users can switch between different quality scores 
                to visualize the structure based on specific metrics by selecting the desired score from the
                <i>Color structure by:</i> radio buttons.
              </p>
              <p>
                As in the previous panel, users can learn more about how to use the 3D view in 
                {' '}<a href="https://molstar.org/viewer-docs/" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: Colors.blue }}>Mol* Viewer Documentation</a>.
              </p>
              <p>
                Also, to customize the 2D view, users can click ⚙️ button to access additional settings, such as adjusting 
                the numbering, outline, labeling of the nodes and turning on/off visibility of connections and clashes.
              </p>
              <br />
              <p>
                If user has run refinement, then they can select modes of displaying the structure:
              </p>
              <ul className="list-disc ml-3">
                <li>
                  <b>Original</b> - Displays the original structure before refinement.
                </li>
                <li>
                  <b>After refinement</b> - Displays the refined structure after refinement.
                </li>
                <li>
                  <b>Show 3D alignment</b> - Displays both original (orange) and post-refinement (blue) structures for comparison in the 3D view
                  in ball-and-stick representation.
                </li>
              </ul>
              <br />
              <p>
                The <i>Visualization mode</i> radio buttons serve as the switch between two coloring modes for the structure in 2D and 3D views.
              </p>
              <ul className="list-disc ml-3">
                <li>
                  <b>Continous coloring</b> - Colors the structure continously in green-to-red scale based on the quality scores, 
                  providing a quick visual representation of the structure's quality. The coloring legend is displayed below the views.
                </li>
                <li>
                  <b>Error-focused highlighting</b> - In this mode, only the residues with errors of the selected quality score 
                  are highlighted in orange, the rest of the selected region is displayed in white, while the unselected region is 
                  displayed in gray. 
                </li>
              </ul>
            </div>
            <h3
              id="system-requirements"
              className="text-xl font-bold mt-5 mb-4 scroll-mt-16"
              style={{ color: Colors.blue }}
            >
              System requirements
            </h3>
            <p>
              RNAmoley is a web-based application, therefore it can be accessed from any device with a modern web browser or a mobile web browser.
              The application was tested on the following browsers:
            </p>
            <ul className="list-disc ml-3">
              <li>Google Chrome (149.0.7827.156)</li>
              <li>Mozilla Firefox (152.0.2)</li>
              <li>Microsoft Edge (149.0.4022.80)</li>
              <li>Apple Safari (17.2.1)</li>
              <li>Mobile Safari (26.5)</li>
              <li>Google Chrome for Android (134.0.6998.135)</li>
              <li>Samsung Internet (29.0.1.12)</li>
            </ul>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default HelpPage;
