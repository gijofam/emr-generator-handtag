const path=require('path');const express=require('../../node_modules/express');const cors=require('../../node_modules/cors');
const config=require('../../src/config/app');config.outputDir=path.join(__dirname,'output');
const app=express();app.use(cors());app.use(express.json({limit:'20mb'}));
app.use('/output',express.static(config.outputDir));
app.use('/api/calibration',require('../../src/routes/calibrationRoutes'));
app.use('/api/templates',require('../../src/routes/templatesRoutes'));
app.get('/api/handtags/products',(_req,res)=>res.json([]));app.get('/api/batches',(_req,res)=>res.json([]));
app.use((err,_req,res,_next)=>res.status(500).json({message:err.message}));
app.listen(4000,'127.0.0.1',()=>console.log('Calibration test backend: 4000; no database access'));
