import HomeIcon from "./homeIcon";
import Logo from "./logo";

export interface LogoProps {
  page?: string;
}

const TopPanel: React.FC<LogoProps> = ({ page = "Submission panel" }) => {
  return (
    <div className="sticky top-0 bg-white flex flex-row gap-2 pt-2 justify-between pr-10 pb-2 shadow-bottom">
      <Logo />
      <div className="flex-1 flex justify-center">
        <h1 className="text-2xl content-center">{page}</h1>
      </div>
      <HomeIcon />
    </div>
  );
};

export default TopPanel;
