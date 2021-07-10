export class StripeCoordinates {
    constructor(gpIndex, a, b, c) {
        this.gpIndex = gpIndex;
        if(c === undefined)
            this.setIndexInLayerAndLongitude(a, b);
        else
            this.setIndexInStripeLayerAndStripeLatitudeAndLongitude(a, b, c);
    }

    setIndexInLayerAndLongitude(indexInLayer, longitude) {
        this.longitude = longitude;
        this.indexInLayer = indexInLayer;
    }

    setIndexInStripeLayerAndStripeLatitudeAndLongitude(indexInStripeLayer, stripeLatitude, longitude) {
        this.indexInStripeLayer = indexInStripeLayer;
        this.stripeLatitude = stripeLatitude;
        this.longitude = longitude;
    }

    setSpiralCoordinates(spiralCoordinates) {
        if(spiralCoordinates.indexInTotal == 0) {
            this.longitude = 0; // South Pole
            this.indexInLayer = 0;
            return;
        }
        let indexInTotal = spiralCoordinates.indexInTotal-1;
        const filedsPerTriangle = ((this.gpIndex-1)*(this.gpIndex-1)+(this.gpIndex-1))/2*5;
        if(indexInTotal < filedsPerTriangle) {
            const longitude = Math.floor((Math.sqrt(5)*Math.sqrt(8*indexInTotal+5)-5)/10);
            this.longitude = longitude+1;
            this.indexInLayer = indexInTotal-(longitude*longitude+longitude)/2*5;
            return;
        }
        indexInTotal -= filedsPerTriangle;
        const fieldsInRombus = this.gpIndex*(this.gpIndex+1)*5;
        if(indexInTotal < fieldsInRombus) {
            const longitude = Math.floor(indexInTotal/(this.gpIndex*5));
            this.longitude = this.gpIndex+longitude;
            this.indexInLayer = indexInTotal-longitude*this.gpIndex*5;
            return;
        }
        indexInTotal -= fieldsInRombus;
        if(indexInTotal < filedsPerTriangle) {
            indexInTotal = filedsPerTriangle-indexInTotal-1;
            const longitude = Math.floor((Math.sqrt(5)*Math.sqrt(8*indexInTotal+5)-5)/10);
            this.longitude = this.gpIndex*3-longitude-1;
            this.indexInLayer = (longitude+1)*5-(longitude*longitude+longitude)/2*5-1;
            return;
        }
        this.longitude = this.gpIndex*3; // North Pole
        this.indexInLayer = 0;
    }

    setEquatorCoordinates(equatorCoordinates) {
        this.longitude = equatorCoordinates.longitude;
        let latitude = equatorCoordinates.latitude;
        if(longitude > this.gpIndex*2)
            latitude -= longitude-this.gpIndex*2;
        this.stripeLatitude = Math.floor(latitude/this.gpIndex),
        this.indexInStripeLayer = latitude%this.gpIndex;
    }

    fieldCountInStripeLayer() {
        return (this.longitude == 0 || this.longitude == this.gpIndex*3) ? 1 :
               (this.longitude < this.gpIndex) ? this.longitude :
               (this.longitude <= this.gpIndex*2) ? this.gpIndex :
               this.gpIndex*3-this.longitude;
    }

    fieldCountInLayer() {
        return (this.longitude == 0 || this.longitude == this.gpIndex*3) ? 1 :
               this.fieldCountInStripeLayer()*5;
    }

    get stripeLongitude() {
        return Math.floor(this.longitude/this.gpIndex);
    }

    get indexInLayer() {
        return this.stripeLatitude*this.fieldCountInStripeLayer()+this.indexInStripeLayer;
    }

    set indexInLayer(indexInLayer) {
        const fieldCountInStripeLayer = this.fieldCountInStripeLayer();
        this.indexInStripeLayer = indexInLayer%fieldCountInStripeLayer;
        this.stripeLatitude = Math.floor(indexInLayer/fieldCountInStripeLayer);
    }

    isPole() {
        return this.indexInStripeLayer == 0 && this.longitude%this.gpIndex == 0;
    }

    setAntipodal(layerCoordinates) {
        this.longitude = this.gpIndex*3-layerCoordinates.longitude,
        this.indexInLayer = (layerCoordinates.indexInLayer+(
            (layerCoordinates.longitude < this.gpIndex) ? layerCoordinates.longitude*3 :
            (layerCoordinates.longitude <= 2*this.gpIndex) ? this.longitude+this.gpIndex :
            this.longitude*2
        ))%this.fieldCountInLayer();
    }
}
