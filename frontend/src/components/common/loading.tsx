import ReactLoading from "react-loading";
import Logo from "./logo";
import HelpIcon from "./helpIcon";
import HomeIcon from "./homeIcon";

export default function Loading({ page = "Loading", message = "Loading..." }) {
  return (
    <div>
      <div className="flex flex-row pt-2 pl-4 gap-8">
        <Logo />
        <HomeIcon />
        <HelpIcon />
      </div>
      <div className="flex flex-col items-center text-4xl font-bold">
        <h1 className="my-36">{message}</h1>
        <ReactLoading
          type="spinningBubbles"
          color="#33a19a"
          height={300}
          width={150}
        />
      </div>
    </div>
  );
}
