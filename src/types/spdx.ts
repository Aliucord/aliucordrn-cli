export interface SPDXLicensesInfo {
    licenseListVersion: string;
    licenses:           License[];
    releaseDate:        Date;
}

export interface License {
    reference:             string;
    isDeprecatedLicenseId: boolean;
    detailsUrl:            string;
    referenceNumber:       number;
    name:                  string;
    licenseId:             string;
    seeAlso:               string[];
    isOsiApproved:         boolean;
    isFsfLibre?:           boolean;
}