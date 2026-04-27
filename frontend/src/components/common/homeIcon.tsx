import { Link } from "react-router-dom";

const HomeIcon = () => {
  return (
    <div
      className="justify-start flex flex-row items-center gap-4 pl-2 text-md font-medium z-[2000] transition-colors"
    >
      <Link to="/" className="font-medium whitespace-nowrap hover:text-teal-600">
        Home
      </Link>
      <Link to="/help" className="whitespace-nowrap hover:text-teal-600">
        Help
      </Link>
      <Link to="/about" className="whitespace-nowrap hover:text-teal-600">
        About
      </Link>
      <Link to="/cite" className="whitespace-nowrap hover:text-teal-600">
        Cite Us
      </Link>
    </div>
  );
};

export default HomeIcon;
