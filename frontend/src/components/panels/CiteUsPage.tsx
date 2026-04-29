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
          className="shadow-[0_5px_10px_rgba(0,0,0,0.1)] rounded-2xl w-[80vw] h-[auto] p-8 overflow-y-auto"
          style={{ background: Colors.backgroundBeige }}
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
          <p>
            Mikolaj Mlynarczyk, Simón Poblete, Marta Szachniuk (2026) RNAmoley: uncovering and refining structural inaccuracies in RNA 3D models. <i>submitted</i> 
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CiteUsPage;