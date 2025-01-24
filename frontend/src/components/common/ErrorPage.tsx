import Logo from "./logo";
import HelpIcon from "./helpIcon";
import HomeIcon from "./homeIcon";

export interface ErrorPageProps {
  errorMessage?: string;
  statusCode?: string;
}

const ErrorPage: React.FC<ErrorPageProps> = ({ errorMessage = "Something is wrong.", statusCode = "" }) => {
  return (
    <div>
      <div className="flex flex-row pl-2 gap-8">
        <Logo page="Error" />
        <HomeIcon />
        <HelpIcon />
      </div>
      <div className="flex min-h-screen flex-col items-center p-24 pt-0">
        <span className="p-24">
          <div className="flex flex-col items-center text-4xl font-bold">
            <h1 className="flex justify-center text-teal-600 p-5">
              Error {statusCode}
            </h1>
            <span className="font-normal text-2xl">{errorMessage}</span>
          </div>
        </span>
      </div>
    </div>
  );
};

export default ErrorPage;
