import ReactLoading from "react-loading";
import Logo from "./logo";
import HomeIcon from "./homeIcon";

export default function Loading({ page = "Loading", message = "Loading..." }) {
  return (
    <div>
      <div className="sticky top-0 bg-white flex flex-row gap-2 pt-2 justify-between pr-10 pb-2 shadow-bottom">
        <Logo />
        <HomeIcon />
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
