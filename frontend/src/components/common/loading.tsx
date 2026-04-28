import ReactLoading from "react-loading";
import Logo from "./logo";
import HomeIcon from "./homeIcon";

export default function Loading({ page = "Loading", message = "Loading..." }) {
  return (
    <div>
      <div className="pl-[10vw] flex flex-col gap-2 pt-2">
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
