import { Colors } from "../common/colors";
import Logo from "../common/logo";
import HomeIcon from "../common/homeIcon";
import Footer from "../common/footerComponent";

const CiteUsPage = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="sticky top-0 bg-white flex flex-row gap-2 pt-2 justify-between pr-10 pb-2 shadow-bottom">
        <Logo />
        <HomeIcon />
      </div>
      <div className="flex flex-1 flex-col items-center pb-16 pt-6">
        <div
          className="border border-gray-100 shadow-md rounded w-[80vw] h-[auto] p-8 overflow-y-auto"
        >
          <h2
            className="text-2xl font-bold mb-4"
            style={{ color: Colors.blue }}
          >
            Cite Us
          </h2>
          <p>
            Any published work that has made use of RNAmoley should cite the following paper:
          </p>
          <p className="mt-4">
            Mikolaj Mlynarczyk, Simón Poblete, Marta Szachniuk (2026) RNAmoley: uncovering and refining structural inaccuracies in RNA 3D models. <i>submitted</i> 
          </p>
          <br />
          <br />
          <p className="font-medium">
            Background and Related Work
          </p>
          <br />
          <p>
            RNAmoley is part of our ongoing research on the assessment, validation, and improvement of RNA 3D structures. The following publications describe methods and concepts for RNA 3D structure evaluation and stereochemical quality assessment, providing the scientific background for the tool.
          </p>
          <ul className="list-disc list-inside mt-4">
            <li>
              Carrascoza F, Antczak M, Miao Z, Westhof E, Szachniuk M (2022) Evaluation of the stereochemical quality of predicted RNA 3D models in the RNA-Puzzles submissions, <i>RNA</i> 28(2):250-262 (doi: <a href="https://doi.org/10.1261/rna.078685.121" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: Colors.blue }}>10.1261/rna.078685.121</a>).
            </li>
            <li>
              Mackowiak M, Adamczyk B, Szachniuk M, Zok T (2024) RNAtango: analysing and comparing RNA 3D structures via torsional angles, <i>PLoS Computational Biology</i> 20(10):e1012500 (doi: <a href="https://doi.org/10.1371/journal.pcbi.1012500" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: Colors.blue }}>10.1371/journal.pcbi.1012500</a>).
            </li>
            <li>
              Poblete S, Mlynarczyk M, Szachniuk M (2025) Unknotting RNA: a method to resolve computational artifacts, <i>PLoS Computational Biology</i> 21(3):e1012843 (doi: <a href="https://doi.org/10.1371/journal.pcbi.1012843" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: Colors.blue }}>10.1371/journal.pcbi.1012843</a>).
            </li>
          </ul>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CiteUsPage;