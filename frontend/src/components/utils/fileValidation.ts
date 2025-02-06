export const isFileValid = (fileName: string): boolean =>{
    const validExtensions = [".pdb", ".mmCIF", ".cif"];
    const fileExtension = fileName.slice(fileName.lastIndexOf('.'));
    return validExtensions.includes(fileExtension);
}
