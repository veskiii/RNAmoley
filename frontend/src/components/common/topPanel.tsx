import HomeIcon from "./homeIcon";
import Logo from "./logo";

export interface LogoProps {
  page?: string;
}

const TopPanel: React.FC<LogoProps> = ({ page = "Submission panel" }) => {
  return (
    <div className="flex overflow-hidden">
      <div className="w-80">
        <Logo />
        <HomeIcon />
      </div>
      <div className="flex-1 flex justify-center">
        <h1 className="text-2xl content-center">{page}</h1>
      </div>
    </div>
  );
};

export default TopPanel;
