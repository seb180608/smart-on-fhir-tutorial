(function (window) {
  // Modern SMART on FHIR v2+ compliant implementation with async/await
  window.extractData = async function () {
    try {
      // Wait for FHIR client to be ready - v2+ pattern
      const client = await FHIR.oauth2.ready();

      console.log('FHIR Client', client);

      // Check for patient context - v2+ pattern
      if (!client.patient) {
        throw new Error('No patient context available');
      }

      // Build query for observations using v2 client.request()
      const query = new URLSearchParams();
      query.set("patient", client.patient.id);
      query.set("_count", 100);
      query.set("code", [
        'http://loinc.org|8302-2', // height
        'http://loinc.org|8462-4', // diastolic BP
        'http://loinc.org|8480-6', // systolic BP
        'http://loinc.org|2085-9', // HDL
        'http://loinc.org|2089-1', // LDL
        'http://loinc.org|55284-4' // BP panel
      ].join(","));

      // Wait for both patient and observations data concurrently
      const [patient, observations] = await Promise.all([
        client.patient.read(),
        client.request("Observation?" + query, {
          pageLimit: 0,   // get all pages
          flat: true      // return flat array of Observation resources
        })
      ]);

      // Use client.byCodes helper - v2+ pattern
      const byCodes = client.byCodes(observations, 'code');
      const gender = patient.gender;

      let fname = '';
      let lname = '';

      if (patient.name && patient.name[0]) {
        fname = patient.name[0].given ? patient.name[0].given.join(' ') : '';
        lname = patient.name[0].family;
        // Handle both string and array formats for family name
        if (Array.isArray(lname)) {
          lname = lname.join(' ');
        }
      }

      const height = byCodes('8302-2');
      const systolicbp = getBloodPressureValue(byCodes('55284-4'), '8480-6');
      const diastolicbp = getBloodPressureValue(byCodes('55284-4'), '8462-4');
      const hdl = byCodes('2085-9');
      const ldl = byCodes('2089-1');

      const p = defaultPatient();
      p.birthdate = patient.birthDate;
      p.gender = gender;
      p.fname = fname;
      p.lname = lname;
      p.height = getQuantityValueAndUnit(height[0]);

      if (typeof systolicbp !== 'undefined') {
        p.systolicbp = systolicbp;
      }

      if (typeof diastolicbp !== 'undefined') {
        p.diastolicbp = diastolicbp;
      }

      p.hdl = getQuantityValueAndUnit(hdl[0]);
      p.ldl = getQuantityValueAndUnit(ldl[0]);

      return p;
    } catch (error) {
      console.error('FHIR data extraction failed:', error);
      throw error; // Re-throw to maintain error propagation
    }
  };

  function defaultPatient() {
    // Simplified patient object structure - v2+ pattern
    return {
      fname: '',
      lname: '',
      gender: '',
      birthdate: '',
      height: '',
      systolicbp: '',
      diastolicbp: '',
      ldl: '',
      hdl: '',
    };
  }

  function getBloodPressureValue(BPObservations, typeOfPressure) {
    if (!BPObservations || !Array.isArray(BPObservations)) {
      return undefined;
    }

    const formattedBPObservations = [];
    BPObservations.forEach((observation) => {
      if (!observation.component) return;

      const BP = observation.component.find((component) => {
        return component.code && component.code.coding &&
          component.code.coding.find((coding) => {
            return coding.code === typeOfPressure;
          });
      });

      if (BP && BP.valueQuantity) {
        observation.valueQuantity = BP.valueQuantity;
        formattedBPObservations.push(observation);
      }
    });

    return getQuantityValueAndUnit(formattedBPObservations[0]);
  }

  function getQuantityValueAndUnit(ob) {
    // More robust checking with modern JavaScript patterns
    if (ob?.valueQuantity?.value !== undefined && ob?.valueQuantity?.unit !== undefined) {
      return `${ob.valueQuantity.value} ${ob.valueQuantity.unit}`;
    }
    return undefined;
  }

  window.drawVisualization = function (p) {
    const holderElement = document.getElementById('holder');
    const loadingElement = document.getElementById('loading');

    if (holderElement) holderElement.style.display = 'block';
    if (loadingElement) loadingElement.style.display = 'none';

    const updateElement = (id, value) => {
      const element = document.getElementById(id);
      if (element && value !== undefined) {
        element.textContent = value;
      }
    };

    updateElement('fname', p.fname);
    updateElement('lname', p.lname);
    updateElement('gender', p.gender);
    updateElement('birthdate', p.birthdate);
    updateElement('height', p.height);
    updateElement('systolicbp', p.systolicbp);
    updateElement('diastolicbp', p.diastolicbp);
    updateElement('ldl', p.ldl);
    updateElement('hdl', p.hdl);
  };

})(window);
