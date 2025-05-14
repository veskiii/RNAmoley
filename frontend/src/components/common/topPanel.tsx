import { Colors } from "./colors";
import HelpIcon from "./helpIcon";
import Logo from "./logo";

export interface LogoProps {
  page?: string;
}

const TopPanel: React.FC<LogoProps> = ({ page = "Submission panel" }) => {
  return (
    <div className="flex flex-wrap justify-between items-center mx-auto">
      <div className="flex flex-none justify-between w-80">
        <Logo />
        <HelpIcon />
      </div>
      <div className="flex-grow text-center">
        <h1 className="text-2xl">{page}</h1>
      </div>
    </div>
  );
};

export default TopPanel;
