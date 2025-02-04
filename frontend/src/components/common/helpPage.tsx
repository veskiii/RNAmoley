import { Colors } from "./colors";
import Logo from "./logo";
import HomeIcon from "./homeIcon";

const HelpPage = () => {
    return (
        <div>
            <div className="pl-[10vw] flex flex-row gap-8 pt-2">
            <div className="pl-[10vw] flex flex-row gap-8 pt-2">
                <Logo page="Help" />
                <HomeIcon />

            </div>
            <div className="flex min-h-screen flex-col items-center pb-16 pt-6">
            <div className="flex min-h-screen flex-col items-center pb-16 pt-6">
                <div
                    className="shadow-[0_5px_10px_rgba(0,0,0,0.1)] rounded-2xl w-[80vw] h-[auto] p-8 overflow-y-auto"
                    style={{ background: Colors.backgroundBeige }}
                >
                    <h2 className="text-2xl font-bold mb-4" style={{ color: Colors.blue }}>General information</h2>
                    <p>
                        RNAmoley is an application designed for RNA analysis, enabling users to upload data and
                        view results through RNA structure visualizations in 2D and 3D. The application supports file
                        formats such as PDB (.pdb) and mmCIF (.mmCIF, .cif) as well as structure identifiers (PDB ID).
                        The primary goal of RNAmoley is to facilitate working with RNA data via an intuitive interface
                        and advanced visualization tools.
                    </p>

                    <h2 className="text-2xl font-bold mt-6 mb-4" style={{ color: Colors.blue }}>RNAmoley workflow</h2>
                    <p>
                        After uploading data, the application follows these steps:
                    </p>
                    <ol className="list-decimal list-inside ml-6">
                        <li>Input validation: Verifies the correctness of uploaded files or entered PDB ID.</li>
                        <li>RNA structure processing: Prepares the data for visualization in 2D and 3D formats.</li>
                        <li>Result generation: Displays the uploaded RNA structure and enables further analysis.</li>
                    </ol>

                    <h2 className="text-2xl font-bold mt-6 mb-4" style={{ color: Colors.blue }}>Input data preprocessing</h2>
                    <p>
                        RNAmoley applies the following rules during input data processing:
                    </p>
                    <ul className="list-disc list-inside ml-6">
                        <li>Only RNA structures are accepted. All other elements (e.g., proteins, water) are
                            discarded.
                        </li>
                        <li>Supported file formats include PDB (.pdb) and mmCIF (.mmCIF, .cif).</li>
                        <li>The PDB ID must be a 4-character alphanumeric string.</li>
                        <li>In multi-model files, the first model is analyzed by default. Users can switch to another
                            model using options in the analysis panel
                        </li>
                        <li>Malformed data results in task rejection.</li>
                    </ul>

                    <h2 className="text-2xl font-bold mt-6 mb-4" style={{ color: Colors.blue }}>How to use RNAmoley</h2>
                    <div className="pl-4">
                        <h3 className="text-xl font-bold mt-5 mb-4" style={{ color: Colors.blue }}>Upload the structure</h3>
                        <ol className="list-decimal list-inside ml-6">
                            <li>Choose one of the three data input methods:
                                <ul className="list-disc list-inside ml-6">
                                    <li><b>Upload file</b> – Upload an RNA file in PDB or mmCIF format.</li>
                                    <li><b>Fetch by PDB ID</b> – Enter a PDB structure identifier.</li>
                                    <li><b>Choose from samples</b> – Select an RNA structure from provided examples.</li>
                                </ul>
                            </li>
                            <li>Optionally, assign a name to the task by entering it in the “Name of task” field.</li>
                            <li>Ensure that the entered data meets the application’s requirements.</li>
                            <li>Click the “Run” button, which becomes active after all data is correctly filled out.</li>
                        </ol>

                        <h3 className="text-xl font-bold mt-5 mb-4" style={{ color: Colors.blue }}>Visualization and analysis</h3>


                        <p>
                            Once a task is submitted, users are redirected to the analysis panel, where they can review the
                            RNA structure. Key panel
                            features include:
                        </p>
                        <ul className="list-disc list-inside ml-6">
                            <li>RNA structure visualization in 2D and 3D views.</li>
                            <li>Toggle between views using a button in the top-right corner.</li>
                        </ul><br />

                        <p><b>Here are a few ways to select elements from structure :</b></p>
                        <div className="pl-4">
                            <p><b>Selecting in 3D View:</b></p>
                            <ul className="list-disc list-inside ml-6">
                                <li>Click the cursor icon (<i>Toggle Selection Mode</i>) on the right side of the screen.</li>
                                <li>Choose the desired element from the structure or the sequence visible after expanding the menu by clicking <i>Toggle Panel Menu</i>.</li>
                            </ul>

                            <p><b>Selecting in 2D View:</b></p>
                            <ul className="list-disc list-inside ml-6">
                                <li>Interact with the graph. For detailed instructions, refer to the side menu in the "How to use fornac" tab.</li>
                                <li>Choose the desired element from the sequence displayed at the top of the page.</li>
                            </ul>

                            <p><b>Selecting in Both Views Using the Range at the Top:</b></p>
                            <ul className="list-disc list-inside ml-6">
                                <li>Select the chain of interest then specify the index range within which you want to select the structure.</li>
                            </ul>
                        </div>

                        <h3 className="text-xl font-bold mt-5 mb-4" style={{ color: Colors.blue }}>Configuration options</h3>
                        <p>The analysis panel offers a sidebar menu on the left side of the analysis panel for managing
                            secondary structure analysis features, changing model and setting parameters of analysis. It is
                            divided into three tabs:</p>
                        <ul className="list-disc ml-8">
                            <li><strong>Fornac options:</strong> Customize the RNA secondary structure graph view to fit
                                your preferences.
                            </li>
                            <li><strong>Analyze structure:</strong>
                                <ul className="list-disc ml-6">
                                    <li>Switch between whole-structure analysis and fragment analysis for focused
                                        exploration.
                                    </li>
                                    <li>Use the "Change Model" button to select and apply a different RNA model for
                                        analysis.
                                    </li>
                                    <li>Set key parameters such as "Radius" and "Interval" for advanced analysis tools like
                                        the rolling ball method.
                                    </li>
                                </ul>
                            </li>
                            <li><strong>How to use Fornac:</strong> A brief guide for users needing assistance with selecting fragment to analyze on 2D
                                visualization.
                            </li>
                        </ul>
                        <h3 className="text-xl font-bold mt-5 mb-4" style={{ color: Colors.blue }}>Graph customization - Fornac options</h3>
                        <p>Enhance the visual experience in both Analysis and Result Panel with options like:</p>
                        <ul className="list-disc ml-8">
                            <li><strong>Numbering, Label interval:</strong> Adjust node numbering and interval labels for
                                easier navigation.
                            </li>
                            <li><strong>Node Outline:</strong> Improves clarity by highlighting node boundaries.</li>
                            <li><strong>Node Label:</strong> Displays nucleotide symbols.</li>
                            <li><strong>Links:</strong> Toggle visibility of links between nucleotides.</li>
                            <li><strong>Enable Animation:</strong> Adds dynamic behavior to the graph based on molecular
                                forces.
                            </li>
                            <li>Manipulate the graph's position, zoom using the scroll wheel, or reset with the "C" key.
                            </li>
                        </ul>

                        <h3 className="text-xl font-bold mt-5 mb-4" style={{ color: Colors.blue }}>Get analysis result</h3>
                        <p>After selecting options and structure fragments, use the "Analyze" button to view the
                            summary:</p>
                        <ul className="list-disc ml-8">
                            <li>Visualize results in 2D and 3D, with colored quality measures.</li>
                            <li>Export analysis as a link or download all related files.</li>
                        </ul>

                        <h3 className="text-xl font-bold mt-5 mb-4" style={{ color: Colors.blue }}>Structure coloring</h3>
                        <p>Color visualised structure by chosen quality measure:</p>
                        <ul className="list-disc ml-8">
                            <li><strong>2D structure:</strong> For the full structure analysis click the table header with
                                chosen measure to color graph.
                            </li>
                            <li><strong>3D structure:</strong> For the full structure analysis choose <i>Toggle Controls
                                Panel</i> (key icon in Mol* Viewer UI in top-right corner) -&gt; <i>Polymer
                                    actions</i> (three dots in bottom-right
                                corner) -&gt; <i>Set coloring</i> -&gt; <i>Color by quality</i> -&gt; <i>Chosen
                                    measure</i>. <br />
                                For the structure fragment analysis coloring is called the same way, only in this case
                                choose <i>Set coloring</i> -&gt; <i>Color by fragment</i>.
                            </li>
                        </ul>

                        <h3 className="text-xl font-bold mt-5 mb-4" style={{ color: Colors.blue }}>Export and Save</h3>
                        <p>Export your work using buttons:</p>
                        <ul className="list-disc ml-8">
                            <li><strong>Copy link to workspace:</strong> Generate a direct link to the analysis view.</li>
                            <li><strong>Download result files:</strong> Save all analysis-related files in a compressed
                                folder.
                            </li>
                        </ul>
                        <p className="mt-4">
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HelpPage;


