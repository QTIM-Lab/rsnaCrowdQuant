# -*- coding: utf-8 -*-
"""
Created on Thu Nov 16 10:56:35 2017

@author: James
"""

from os.path import join, isdir, splitext
from os import mkdir
import math
from glob import glob
from bs4 import BeautifulSoup as Soup
import json
import couchdb


def process_aim_files(aim_dir, cred_dict):
    
    # Directory to store JSON files
    out_dir = aim_dir + '/json'
    if not isdir(out_dir):
        mkdir(out_dir)
    
    # Files to keep track of chronicle entries
    in_chronicle = open(join(out_dir, 'in_chronicle.txt'), 'a')
    missing_chronicle = open(join(out_dir, 'missing_chronicle.txt'), 'a')
    
    # Connect to couch database
    couch = couchdb.Server('http://{user}:{pwd}@rsnacrowdquant.cloudapp.net:5984'.format(cred_dict))
    chronicle = couch['chronicle']
    
    try:
        ground_truth = couch['ground_truth']
    except:
        ground_truth = couch.create('ground_truth')
        
    # Get aim files     
    aim_files = glob(join(aim_dir, '*.xml'))
    
    for xml_file in aim_files:
        
        # Get seriesUID and instanceUID
        soup = Soup(open(xml_file).read(), 'xml')

        # Get IDs        
        seriesUID = soup.find('imageStudy').findChild('instanceUid', recursive=False)['root']
        instanceUID = soup.find('imageCollection').findChild('sopInstanceUid')['root']
        annotation = {'seriesUID': seriesUID, 'instanceUID': instanceUID}
        
        # Verify record exists in the chronicle database
        in_db = instanceUID in chronicle
        str_ = xml_file + ',' + instanceUID + '\n'
                
        if in_db:
            
            in_chronicle.writelines(str_)
            
            # Find annotation coordinaates (in some space...)
            for coord in soup.find_all('TwoDimensionSpatialCoordinate'):
                            
                index = coord.find_all('coordinateIndex')[0]['value']
                prefix = 'start' if int(index) == 0 else 'end'
                x = float(coord.find_all('x')[0]['value'])
                y = float(coord.find_all('y')[0]['value'])
                
                x_key = prefix + '_x'
                y_key = prefix + '_y'
                
                annotation.update({x_key: x, y_key: y})
            
            # Get length measurement
            length = soup.find_all('CalculationData')[0].findChild('value')['value']
            annotation['length'] = float(length)
            print "Inserting '{}'".format(xml_file)
            ground_truth.save(annotation)
            
            # JSON
            json_out = join(out_dir, splitext(xml_file)[0] + '.json')
            dict_to_json(annotation, out_file=json_out)
            
        else:
            missing_chronicle.write(str_)

        
        
def compute_vec_length(annotation):
    
    length = math.sqrt((annotation['end_x'] - annotation['start_x'])**2 
                     + (annotation['end_y'] - annotation['start_y'])**2)
    annotation['length'] = length


def dict_to_json(aim_dict, out_file=None):
    
    json_str = json.dumps(aim_dict)
    if out_file is not None:
        
        with open(out_file, 'w') as f:
            f.write(json_str)
    return json_str
        
if __name__ == '__main__':
    
    import sys
    
    input_dir = sys.argv[1]
    cred_dict = dict(user=sys.argv[2], pwd=sys.argv[3])
    json_strings = process_aim_files(input_dir, cred_dict)
