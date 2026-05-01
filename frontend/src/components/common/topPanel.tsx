import HomeIcon from "./homeIcon";
import Logo from "./logo";

export interface LogoProps {
  page?: string;
}

const TopPanel: React.FC<LogoProps> = ({ page = "Submission panel" }) => {
  return (
    <div className="sticky top-0 bg-white flex flex-row gap-2 pt-2 justify-between pr-10 pb-2 shadow-bottom">
      <Logo />
      <HomeIcon />
    </div>
  );
};

export default TopPanel;
