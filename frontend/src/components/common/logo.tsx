import { Colors } from "./colors";

export interface LogoProps {
  page?: string;
}

const Logo: React.FC<LogoProps> = ({ page = "Submission panel" }) => {
  return (
    <div className="flex flex-row text-2xl font-medium items-center self-start">
      <div className="flex flex-col">
        <div className="font-bold">
          <h1>RNA</h1>
        </div>
        <div className="font-semibold" style={{ color: Colors.blue }}>
          <h1>MOLEY</h1>
        </div>
      </div>
      <h1 className="pl-2">| {page}</h1>
    </div>
  );
};

export default Logo;
