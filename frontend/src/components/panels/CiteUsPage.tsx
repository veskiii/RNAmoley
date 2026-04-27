import { Colors } from "../common/colors";
import Logo from "../common/logo";
import HomeIcon from "../common/homeIcon";

const CiteUsPage = () => {
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
            Cite Us
          </h2>
          <p>
            Any published work that has made use of RNAmoley should cite the following paper:
          </p>
          <p className="font-semibold">
            Mikolaj Mlynarczyk, Simon Poblete, Marta Szachniuk (2026) RNAmoley: uncovering and refining local inaccuracies in RNA 3D structures. submitted 
          </p>
        </div>
      </div>
    </div>
  );
};

export default CiteUsPage;