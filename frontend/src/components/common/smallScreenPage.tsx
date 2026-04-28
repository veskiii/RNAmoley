import Logo from "./logo";
import HomeIcon from "./homeIcon";
import "../../App.css";

const SmallScreenPage = () => {
  return (
    <div className="mobile-message">
      <div className="pl-[10vw] flex flex-col gap-2 pt-2">
        <Logo />
        {/* <HomeIcon /> */}
      </div>
      <div className="flex min-h-screen justify-center  flex-col items-center p-24 pt-0">
        <span className="p-24">
          <div className="flex flex-col items-center text-4xl font-bold">
            <h1 className="flex justify-center text-teal-600 p-5">
              Sorry, the content of this page is not available on small screen
              devices.
            </h1>
          </div>
        </span>
      </div>
    </div>
  );
};

export default SmallScreenPage;
