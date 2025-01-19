import { Colors } from "../common/colors";
import { useNavigate } from "react-router-dom";

const HelpPage = () => {
      const navigate = useNavigate();
    return (
        <div className="flex min-h-screen flex-col items-center pb-16">
            <div className="flex flex-row text-3xl font-medium items-center self-start pl-[10vw] py-4 cursor-pointer"
            onClick={() => navigate("/")}
            >
                <div className="flex flex-col">
                    <div className="font-extrabold">
                        <h1>RNA</h1>
                    </div>
                    <div className="font-semibold pr-2" style={{ color: Colors.blue }}>
                        <h1>MOLEY</h1>
                    </div>
                </div>
                <h1>| Help</h1>
            </div>
            <div
                className="shadow-[0_5px_10px_rgba(0,0,0,0.1)] rounded-2xl w-[80vw] h-[auto] p-6 overflow-y-auto bg-white"
                style={{ background: Colors.backgroundBlue }}
            >
                <h2 className="text-2xl font-bold mb-4">General information</h2>
                <p>
                    RNA Moley is an application designed for RNA analysis, enabling users to upload data and
                    view results through RNA structure visualizations in 2D and 3D. The application supports file
                    formats such as PDB (.pdb) and CIF (.mmCIF, .cif) as well as structure identifiers (PDB id).
                    The primary goal of RNA Moley is to facilitate working with RNA data via an intuitive interface
                    and advanced visualization tools.
                </p>

                <h2 className="text-2xl font-bold mt-6 mb-4">RNA Moley workflow</h2>
                <p>
                    After uploading data, the application follows these steps:
                </p>
                <ol className="list-decimal list-inside ml-6">
                    <li>Input validation: Verifies the correctness of uploaded files or entered PDB id codes.</li>
                    <li>RNA structure processing: Prepares the data for visualization in 2D and 3D formats.</li>
                    <li>Result generation: Displays the uploaded RNA structure and enables further analysis.</li>
                </ol>

                <h2 className="text-2xl font-bold mt-6 mb-4">Input data preprocessing</h2>
                <p>
                    RNA Moley applies the following rules during input data processing:
                </p>
                <ul className="list-disc list-inside ml-6">
                    <li>Only RNA structures are accepted. All other elements (e.g., proteins, water) are discarded.</li>
                    <li>Supported file formats include PDB (.pdb) and CIF (.mmCIF, .cif).</li>
                    <li>The PDB id code must be a 4-character alphanumeric string.</li>
                    <li>In multi-model files, the first model is analyzed by default. Users can switch to another model using options in the analysis panel</li>
                    <li>Malformed data results in task rejection.</li>
                </ul>

                <h2 className="text-2xl font-bold mt-6 mb-4">How to use RNA Moley</h2>
                <p>
                    To use RNA Moley:
                </p>
                <ol className="list-decimal list-inside ml-6">
                    <li>Choose one of the three data input methods:
                        <ul className="list-disc list-inside ml-6">
                            <li><b>Upload file</b> – Upload an RNA file in PDB or CIF format.</li>
                            <li><b>Fetch by PDB id</b> – Enter a PDB structure identifier.</li>
                            <li><b>Choose from samples</b> – Select an RNA structure from provided examples.</li>
                        </ul>
                    </li>
                    <li>Optionally, assign a name to the task by entering it in the “Name of task” field.</li>
                    <li>Ensure that the entered data meets the application’s requirements.</li>
                    <li>Click the “Run” button, which becomes active after all data is correctly filled out.</li>
                </ol>

                <h2 className="text-2xl font-bold mt-6 mb-4">Visualization and analysis</h2>
                <p>
                Once a task is submitted, users are redirected to the analysis panel, where they can review the RNA structure. Key panel
                    features include:
                </p>
                <ul className="list-disc list-inside ml-6">
                    <li>RNA structure visualization in 2D and 3D views.</li>
                    <li>Toggle between views using a button in the top-right corner.</li>
                </ul>
                <h2 className="text-2xl font-bold mt-6 mb-2">Configuration Options</h2>
                <p>The analysis panel offers a sidebar menu on the left side of the analysis panel for managing secondary structure analysis features, changing model and setting parameters of analysis. It is divided into three tabs:</p>
                <ul className="list-disc ml-8">
                    <li><strong>Fornac Options:</strong> Customize the RNA secondary structure graph view to fit your preferences.</li>
                    <li><strong>Analyze Structure:</strong>
                        <ul className="list-disc ml-6">
                            <li>Switch between whole-structure analysis and fragment analysis for focused exploration.</li>
                            <li>Use the "Change Model" button to select and apply a different RNA model for analysis.</li>
                            <li>Set key parameters such as "Radius" and "Interval" for advanced analysis tools like the rolling ball method.</li>
                        </ul>
                    </li>
                    <li><strong>How to Use Fornac:</strong> A brief guide for users needing assistance with 2D visualization functions.</li>
                </ul>

                <h2 className="text-2xl font-bold mt-6 mb-2">Interactive Graph Features</h2>
                <p>Using Fornac, you can interact with the visualized graph in various ways:</p>
                <ul className="list-disc ml-8">
                    <li>Select individual nodes with a left-click.</li>
                    <li>Deselect all nodes by clicking on the graph background.</li>
                    <li>Use Ctrl + click to select or deselect multiple nodes.</li>
                    <li>Drag with Ctrl + left-click to select a group of elements (box selection).</li>
                </ul>

                <h2 className="text-2xl font-bold mt-6 mb-2">Graph Customization</h2>
                <p>Enhance the visual experience with options like:</p>
                <ul className="list-disc ml-8">
                <li><strong>Numbering, Label interval:</strong> Adjust node numbering and interval labels for easier navigation.</li>
                    <li><strong>Node Outline:</strong> Improves clarity by highlighting node boundaries.</li>
                    <li><strong>Node Label:</strong> Displays nucleotide symbols.</li>
                    <li><strong>Links:</strong> Toggle visibility of links between nucleotides.</li>
                    <li><strong>Enable Animation:</strong> Adds dynamic behavior to the graph based on molecular forces.</li>
                    <li>Manipulate the graph's position, zoom using the scroll wheel, or reset with the "C" key.</li>
                </ul>

                <h2 className="text-2xl font-bold mt-6 mb-2">Analysis Summary</h2>
                <p>After selecting options and structure fragments, use the "Analyze" button to view the summary:</p>
                <ul className="list-disc ml-8">
                    <li>Visualize results in 2D and 3D, with colored quality measures.</li>
                    <li>Export analysis as a link or download all related files.</li>
                </ul>

                <h2 className="text-2xl font-bold mt-6 mb-2">Export and Save</h2>
                <p>Export your work using:</p>
                <ul className="list-disc ml-8">
                    <li><strong>Copy Link:</strong> Generate a direct link to the analysis view.</li>
                    <li><strong>Download Files:</strong> Save all analysis-related files in a compressed folder.</li>
                </ul>
                <p className="mt-4">
                </p>
            </div>
        </div>
    );
};

export default HelpPage;


