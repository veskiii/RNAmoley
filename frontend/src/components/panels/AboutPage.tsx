import { Colors } from "../common/colors";
import Logo from "../common/logo";
import HomeIcon from "../common/homeIcon";

const AboutPage = () => {
  return (
    <div>
      <div className="sticky top-0 bg-white flex flex-row gap-2 pt-2 justify-between pr-10 pb-2 shadow-bottom">
        <Logo />
        <HomeIcon />
      </div>
      <div className="flex flex-col items-center pb-16 pt-6">
        <div
          className="shadow-[0_5px_10px_rgba(0,0,0,0.1)] rounded-2xl w-[80vw] h-[auto] p-8 overflow-y-auto"
          style={{ background: Colors.backgroundBeige }}
        >
          <h2
            className="text-2xl font-bold mb-4"
            style={{ color: Colors.blue }}
          >
            About RNAmoley
          </h2>
          <p className="text-justify">
            RNAmoley is a web server for local quality assessment of RNA 3D structures. 
            The tool enables detection and characterization of local geometric inaccuracies 
            in RNA models, including steric clashes, bond geometry deviations, and backbone 
            conformational irregularities. RNAmoley uses a sphere-based neighborhood analysis 
            to evaluate structural quality at a local level and provides interactive 2D and 3D 
            visualizations for intuitive inspection of detected issues. In addition, the server 
            offers an option to perform restrained energy minimization for preliminary 
            model refinement.
            </p>
            <h3
              className="text-xl font-bold mt-5 mb-4"
              style={{ color: Colors.blue }}
            >
              Authors
            </h3>
            <p>Prototype development</p>
            <p>Dawid Grajek<sup>1</sup>, Lena Niedzialkowska<sup>1</sup>, Julia Pawlowska<sup>1</sup>, Piotr Walczak<sup>1</sup> (engineering project work), Marta Szachniuk<sup>1,2</sup> (supervision)</p>
            <p className="pt-2">Final implementation and development</p>
            <p>Mikolaj Mlynarczyk<sup>1</sup> (RNAmoley core development, algorithmic improvements, and feature extension), Simon Poblete<sup>3,4</sup>, Marta Szachniuk<sup>1,2</sup> (testing, supervision)</p>
            <p className="pt-2"><sup>1</sup> Institute of Computing Science, Poznan University of Technology, Poland</p>
            <p><sup>2</sup> Institute of Bioorganic Chemistry, Polish Academy of Sciences, Poznan, Poland</p>
            <p><sup>3</sup> Facultad de Ingeniería, Universidad San Sebastián, Santiago, Chile</p>
            <p><sup>4</sup> Centro BASAL Ciencia & Vida, Universidad San Sebastián, Santiago, Chile</p>
            <h3
              className="text-xl font-bold mt-5 mb-4"
              style={{ color: Colors.blue }}
            >
              Acknowledgements and Funding
            </h3>
            <p className="text-justify">
              RNAmoley is supported by the National Science Centre, Poland (NCN), under a research grant 2024/53/B/ST6/02789 awarded to M.S. The system is hosted and maintained by the Institute of Computing Science, Poznan University of Technology. 
            </p>
          </div>
      </div>
    </div>
  );
};

export default AboutPage;