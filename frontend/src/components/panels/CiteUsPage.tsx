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
          <div>
            <p>
              Any published work that has made use of RNAmoley should cite the following paper:
            </p>
            <p className="mt-4">
              Mikolaj Mlynarczyk, Simón Poblete, Marta Szachniuk (2026) RNAmoley: uncovering and refining structural inaccuracies in RNA 3D models. <i>submitted</i> 
            </p>
            <br />
            <br />
          </div>
          <div>
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
            <br />
            <br />
          </div>
          <div>
            <p className="font-medium">
              External tools
            </p>
            <br />
            <p>
              RNAmoley integrates the following external tools in its analysis workflow.
              We acknowledge the authors of these tools here and users may wish to cite them
              using RNAmoley in their own work.
            </p>
            <ul className="list-disc list-inside mt-4">
              <li>
                Antolínez S, Jones PE, Phillips JC, Hadden-Perilla JA (2024) AMBERff at Scale: Multimillion-Atom Simulations with AMBER Force Fields in NAMD, <i>Journal of Chemical Information and Modeling</i> 64, 2, 543-554 (doi: <a href="https://doi.org/10.1021/acs.jcim.3c01648" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: Colors.blue }}>10.1021/acs.jcim.3c01648</a>).
              </li>
              <li>
                Černý J, Malý M, Božíková P, Prchalová T, Svoboda J, Biedermannová L, Schneider B (2026) DNATCO v5.0: integrated web platform for 3D nucleic acid structure analysis. <i>Nucleic Acids Research</i> 54(1):gkaf1491 (doi: <a href="https://doi.org/10.1093/nar/gkaf1491" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: Colors.blue }}>10.1093/nar/gkaf1491</a>).
              </li>
              <li>
                Li S, Olson WK, Lu XJ (2019) Web 3DNA 2.0 for the analysis, visualization, and modeling of 3D nucleic acid structures. <i>Nucleic Acids Research</i> 47(W1): W26-W34 (doi: <a href="https://doi.org/10.1093/nar/gkz279" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: Colors.blue }}>10.1093/nar/gkz279</a>).
              </li>
              <li>
                Phillips JC, Hardy DJ, Maia JDC, Stone JE, Ribeiro JV, Bernardi RC, Buch R, Fiorin G, Henin J, Jiang W, McGreevy R, Melo MCR, Radak BK, Skeel RD, Singharoy A, Wang Y, Roux B, Aksimentiev A, Luthey-Schulten Z, Kale LV, Schulten K, Chipot C, Tajkhorshid E (2020) Scalable molecular dynamics on CPU and GPU architectures with NAMD, <i>Journal of Chemical Physics</i> 153:044130 (doi: <a href="https://doi.org/10.1063/5.0014475" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: Colors.blue }}>10.1063/5.0014475</a>).
              </li>
              <li>
                Williams CJ, Headd JJ, Moriarty NW, Prisant MG, Videau LL, Deis LN, Verma V, Keedy DA, Hintze BJ, Chen VB, Jain S, Lewis SM, Arendall WB 3rd, Snoeyink J, Adams PD, Lovell SC, Richardson JS, Richardson DC (2018) MolProbity: More and better reference data for improved all-atom structure validation. <i>Protein Science</i> 27: 293-315. (doi: <a href="https://doi.org/10.1002/pro.3330" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: Colors.blue }}>10.1002/pro.3330</a>).
              </li>
              <li>
                Wojdyr M (2022) GEMMI: A library for structural biology. <i>Journal of Open Source Software</i> 7(73): 4200 (doi: <a href="https://doi.org/10.21105/joss.04200" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: Colors.blue }}>10.21105/joss.04200</a>).
              </li>
            </ul>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CiteUsPage;